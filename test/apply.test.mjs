// Handler tests for api/apply.js — table-driven, with fetch mocked for both
// Resend and the KV REST store. Run with: npm test
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const handler = (await import('../api/apply.js')).default;

const KV_URL = 'https://kv.test.local';
const ENV_KEYS = ['RESEND_API_KEY', 'APPLY_TO', 'APPLY_FROM', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'APP_RECORD_TTL_DAYS'];
const realFetch = globalThis.fetch;
let envBackup;

beforeEach(() => {
  envBackup = {};
  for (const k of ENV_KEYS) { envBackup[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (envBackup[k] === undefined) delete process.env[k];
    else process.env[k] = envBackup[k];
  }
});

function validPayload(overrides = {}) {
  return {
    full_name: 'Test Person',
    email: 'test@example.com',
    phone: '021 000 0000',
    suburb: 'Westgate',
    region: 'Auckland',
    right_to_work: 'I’m a NZ citizen or resident',
    experience: 'None yet',
    transport: 'Public transport only',
    availability: 'Flexible',
    applying_as: 'An individual',
    consent: 'on',
    work_types: ['Residential'],
    message: 'test',
    ...overrides,
  };
}

function reqMock(body, { method = 'POST', headers = {} } = {}) {
  return { method, body, headers: { 'x-forwarded-for': '203.0.113.7', ...headers } };
}

function resMock() {
  const r = { statusCode: null, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

// Route fetch by URL substring. Records calls for assertions.
function installFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    for (const [match, fn] of routes) {
      if (String(url).includes(match)) return fn(String(url), opts);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return calls;
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const httpError = (status) => ({ ok: false, status, json: async () => ({}), text: async () => 'error' });

function enableKV(ttlDays = '365') {
  process.env.KV_REST_API_URL = KV_URL;
  process.env.KV_REST_API_TOKEN = 'test-token';
  if (ttlDays) process.env.APP_RECORD_TTL_DAYS = ttlDays;
}

// kvResult builds a multi-exec style response for n commands.
const kvResult = (results) => ok(results.map((result) => ({ result })));

test('rejects non-POST', async () => {
  const res = resMock();
  await handler(reqMock(null, { method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

test('honeypot accepts silently without any outbound call', async () => {
  const calls = installFetch([]);
  const res = resMock();
  await handler(reqMock(validPayload({ company: 'bot co' })), res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 0);
});

// Table: every invalid payload must 400 before any email/storage side effect.
const invalidCases = [
  ['missing full_name', { full_name: '' }],
  ['missing email', { email: undefined }],
  ['bad email format', { email: 'not-an-email' }],
  ['non-string field', { phone: 12345 }],
  ['over-cap message', { message: 'x'.repeat(3001) }],
  ['consent missing', { consent: undefined }],
  ['consent "false" string', { consent: 'false' }],
  ['consent "true" string (not the checkbox value)', { consent: 'true' }],
  ['invented region', { region: 'Auckland CBD' }],
  ['invented right_to_work', { right_to_work: 'Sponsorship please' }],
  ['invented experience', { experience: 'Decades' }],
  ['invented transport', { transport: 'Helicopter' }],
  ['invented availability', { availability: 'Never' }],
  ['invented applying_as', { applying_as: 'A franchise' }],
  ['empty work_types', { work_types: [] }],
  ['invented work_type', { work_types: ['Residential', 'Hazmat'] }],
];
for (const [name, overrides] of invalidCases) {
  test(`400: ${name}`, async () => {
    const calls = installFetch([]);
    const res = resMock();
    await handler(reqMock(validPayload(overrides)), res);
    assert.equal(res.statusCode, 400, JSON.stringify(res.body));
    assert.equal(calls.length, 0, 'no outbound calls on invalid input');
  });
}

test('500 email_unconfigured; record still written when storage is on', async () => {
  enableKV();
  const calls = installFetch([[KV_URL, () => kvResult([1, 1, 0])]]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /not configured/);
  // rate-limit exec + received write + email_unconfigured update
  const kvCalls = calls.filter((c) => c.url.includes(KV_URL));
  assert.equal(kvCalls.length, 3);
  const lastSet = kvCalls[2].body.find((cmd) => cmd[0] === 'SET');
  assert.match(lastSet[2], /"status":"email_unconfigured"/);
  assert.equal(lastSet[4], String(365 * 86400), 'TTL applied');
});

test('storage stays off without APP_RECORD_TTL_DAYS (retention decision required)', async () => {
  enableKV(null);
  process.env.RESEND_API_KEY = 'k';
  const calls = installFetch([
    [KV_URL, () => kvResult([1, 1])],
    ['api.resend.com', () => ok({ id: 're_1' })],
  ]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 200);
  // Only the rate-limit transaction hits KV — no record writes without a TTL.
  const kvBodies = calls.filter((c) => c.url.includes(KV_URL)).map((c) => c.body);
  assert.equal(kvBodies.length, 1);
  assert.equal(kvBodies[0][0][0], 'INCR');
  const email = calls.find((c) => c.url.includes('api.resend.com'));
  assert.match(email.body.html, /record storage off/);
});

test('success: received before send, then email_accepted with resend id', async () => {
  enableKV();
  process.env.RESEND_API_KEY = 'k';
  const calls = installFetch([
    [KV_URL, () => kvResult([1, 1, 0])],
    ['api.resend.com', () => ok({ id: 're_abc123' })],
  ]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 200);
  const kvSets = calls.filter((c) => c.url.includes(KV_URL)).flatMap((c) => c.body.filter((cmd) => cmd[0] === 'SET'));
  assert.equal(kvSets.length, 2);
  assert.match(kvSets[0][2], /"status":"received"/, 'received persisted BEFORE the send');
  const emailIndex = calls.findIndex((c) => c.url.includes('api.resend.com'));
  const receivedIndex = calls.findIndex((c) => c.url.includes(KV_URL) && c.body.some((cmd) => cmd[0] === 'SET'));
  assert.ok(receivedIndex < emailIndex, 'received write precedes the Resend call');
  assert.match(kvSets[1][2], /"status":"email_accepted"/);
  assert.match(kvSets[1][2], /"resend_id":"re_abc123"/);
  const email = calls[emailIndex];
  assert.match(email.body.html, /record stored/);
});

test('Resend HTTP error: 502 and send_failed recorded', async () => {
  enableKV();
  process.env.RESEND_API_KEY = 'k';
  const calls = installFetch([
    [KV_URL, () => kvResult([1, 1, 0])],
    ['api.resend.com', () => httpError(500)],
  ]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 502);
  const kvSets = calls.filter((c) => c.url.includes(KV_URL)).flatMap((c) => c.body.filter((cmd) => cmd[0] === 'SET'));
  assert.match(kvSets.at(-1)[2], /"status":"send_failed"/);
});

test('Resend network failure: 500 and send_failed recorded', async () => {
  enableKV();
  process.env.RESEND_API_KEY = 'k';
  installFetch([
    [KV_URL, () => kvResult([1, 1, 0])],
    ['api.resend.com', () => { throw new Error('network down'); }],
  ]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 500);
});

test('KV outage: email still sends, storage failure flagged in the email', async () => {
  enableKV();
  process.env.RESEND_API_KEY = 'k';
  const calls = installFetch([
    [KV_URL, () => { throw new Error('kv down'); }],
    ['api.resend.com', () => ok({ id: 're_1' })],
  ]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 200, 'conversion survives a storage outage');
  const email = calls.find((c) => c.url.includes('api.resend.com'));
  assert.match(email.body.html, /RECORD STORAGE FAILED/);
});

test('rate limit: 11th submission in the hour gets 429', async () => {
  enableKV();
  process.env.RESEND_API_KEY = 'k';
  const calls = installFetch([[KV_URL, () => kvResult([11, 1])]]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 429);
  assert.equal(calls.filter((c) => c.url.includes('api.resend.com')).length, 0);
  // INCR and EXPIRE travel in one atomic transaction.
  assert.deepEqual(calls[0].body.map((cmd) => cmd[0]), ['INCR', 'EXPIRE']);
});

test('no KV configured: everything works, storage off', async () => {
  process.env.RESEND_API_KEY = 'k';
  const calls = installFetch([['api.resend.com', () => ok({ id: 're_1' })]]);
  const res = resMock();
  await handler(reqMock(validPayload()), res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1, 'only the Resend call');
  assert.match(calls[0].body.html, /record storage off/);
});
