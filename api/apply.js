// Vercel serverless function: receives an application, records it, and emails it via Resend.
// Static Astro site + a top-level /api function = Vercel deploys this at /api/apply
// (canonical URL is /api/apply/ under "trailingSlash": true — the form posts there directly).
// The Resend API key is read from the RESEND_API_KEY env var (set in Vercel),
// never committed. Configure the from/to via env with sensible fallbacks.
//
// First-party application record + rate limiting use an Upstash-compatible Redis REST
// store (Vercel KV / Upstash): KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_* pair).
// Recording additionally requires APP_RECORD_TTL_DAYS — the retention decision must be
// made before any personal data is stored; records expire after that many days and the
// index is pruned to match. Store writes are atomic (/multi-exec), fail open for the
// visitor (email path is never blocked), and fail LOUD for us: failures are logged and
// the storage outcome is stamped into the notification email so dataset gaps are visible.
//
// Record lifecycle: received → email_accepted | send_failed | email_unconfigured.
// "email_accepted" means Resend accepted the message for sending (its email id is stored
// as resend_id); "delivered" is reserved for a future authenticated delivery webhook.
// Later statuses (reviewed, onboarded, allocated) are set out of band — see
// scripts/app-records.mjs for list/get/delete.

const FIELDS = [
  ['full_name', 'Full name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['suburb', 'Suburb / town'],
  ['region', 'Region'],
  ['right_to_work', 'Right to work in NZ'],
  ['experience', 'Cleaning experience'],
  ['transport', 'Transport'],
  ['work_types', 'Work types'],
  ['availability', 'Availability'],
  ['applying_as', 'Applying as'],
  ['message', 'Message'],
  ['consent', 'Consent given'],
  ['source_referrer', 'Source (referrer)'],
  ['source_params', 'Source (params)'],
];

// Free-text length caps. Select/checkbox fields are allowlisted below instead.
const MAX_LEN = {
  full_name: 120, email: 200, phone: 40, suburb: 120, message: 3000,
  company: 200, source_referrer: 500, source_params: 500,
};

// Exact values the form can produce (typographic apostrophes as rendered).
const ENUMS = {
  region: ['Northland', 'Auckland', 'Waikato', 'Bay of Plenty', 'Gisborne', 'Hawke’s Bay', 'Taranaki', 'Manawatū-Whanganui', 'Wellington', 'Tasman', 'Nelson', 'Marlborough', 'West Coast', 'Canterbury', 'Otago', 'Southland'],
  right_to_work: ['I’m a NZ citizen or resident', 'I have a valid NZ work visa', 'Not yet', 'Not sure'],
  experience: ['None yet', 'Less than 1 year', '1 to 3 years', '3+ years'],
  transport: ['I have my own transport', 'Public transport only', 'Not at the moment'],
  availability: ['Flexible', 'Weekdays', 'Weekends', 'Mornings', 'Evenings'],
  applying_as: ['An individual', 'A small team', 'A cleaning partnership'],
};
const WORK_TYPES = ['Residential', 'Commercial', 'Specialist', 'Unsure'];

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function readBody(req) {
  return new Promise((resolve) => {
    // Vercel may pre-parse JSON into req.body; otherwise collect the stream.
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

// Env is read lazily so tests can vary configuration per case.
function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function retentionSeconds() {
  const days = Number.parseInt(process.env.APP_RECORD_TTL_DAYS || '', 10);
  return Number.isInteger(days) && days > 0 ? days * 86400 : null;
}

// Atomic command transaction against the REST store. Null on any failure — logged,
// because a silent gap here would quietly corrupt the application dataset.
async function kvExec(commands) {
  const cfg = kvConfig();
  if (!cfg) return null;
  try {
    const r = await fetch(`${cfg.url}/multi-exec`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) {
      console.error('KV multi-exec HTTP error', r.status);
      return null;
    }
    const out = await r.json();
    if (!Array.isArray(out) || out.some((o) => o && o.error)) {
      console.error('KV multi-exec command error', JSON.stringify(out).slice(0, 300));
      return null;
    }
    return out;
  } catch (e) {
    console.error('KV request failed', e);
    return null;
  }
}

// Per-IP hourly cap. INCR and EXPIRE run in one transaction, so a counter can never
// exist without its expiry. Fails open (no store / store error = not limited).
async function rateLimited(ip) {
  if (!ip || !kvConfig()) return false;
  const key = `rl:${ip}`;
  const res = await kvExec([['INCR', key], ['EXPIRE', key, '3600', 'NX']]);
  const count = res && res[0] && typeof res[0].result === 'number' ? res[0].result : null;
  return count !== null && count > 10;
}

// Persist the record with the retention TTL and prune expired ids from the index,
// atomically. Returns 'stored' | 'failed' | 'off'.
async function saveRecord(record) {
  const ttl = retentionSeconds();
  if (!kvConfig() || !ttl) return 'off';
  const score = Date.parse(record.ts);
  const res = await kvExec([
    ['SET', `app:${record.id}`, JSON.stringify(record), 'EX', String(ttl)],
    ['ZADD', 'app:index', String(score), record.id],
    ['ZREMRANGEBYSCORE', 'app:index', '-inf', String(Date.now() - ttl * 1000)],
  ]);
  return res ? 'stored' : 'failed';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const data = await readBody(req);
  if (!data) return res.status(400).json({ ok: false, error: 'Invalid request.' });

  // Honeypot: silently accept bot submissions without emailing or recording.
  if (data.company) return res.status(200).json({ ok: true });

  // Free-text fields: strings within their caps.
  for (const [field, cap] of Object.entries(MAX_LEN)) {
    const v = data[field];
    if (v !== undefined && (typeof v !== 'string' || v.length > cap)) {
      return res.status(400).json({ ok: false, error: 'Invalid request.' });
    }
  }

  // Required free-text fields present.
  for (const f of ['full_name', 'email', 'phone', 'suburb']) {
    if (typeof data[f] !== 'string' || !data[f].trim()) {
      return res.status(400).json({ ok: false, error: 'Please complete all required fields.' });
    }
  }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  // Select fields: exact allowlisted values. region/right_to_work/experience/transport
  // are required; availability/applying_as are optional but must be valid when present.
  for (const [field, allowed] of Object.entries(ENUMS)) {
    const required = ['region', 'right_to_work', 'experience', 'transport'].includes(field);
    const v = data[field];
    if (v === undefined || v === '') {
      if (required) return res.status(400).json({ ok: false, error: 'Please complete all required fields.' });
      continue;
    }
    if (!allowed.includes(v)) {
      return res.status(400).json({ ok: false, error: 'Invalid request.' });
    }
  }

  // Consent must be the browser's exact checked-checkbox value — nothing else counts.
  if (data.consent !== 'on') {
    return res.status(400).json({ ok: false, error: 'Please confirm the privacy consent.' });
  }

  const workTypes = [].concat(data.work_types || []).filter(Boolean);
  if (workTypes.length === 0) {
    return res.status(400).json({ ok: false, error: 'Please choose at least one type of work.' });
  }
  if (workTypes.length > WORK_TYPES.length || workTypes.some((w) => !WORK_TYPES.includes(w))) {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }

  // Vercel sets x-forwarded-for itself, so this is not client-spoofable there.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || '';
  if (await rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later, or email hello@cleaningjobs.co.nz.' });
  }

  // First-party application record: fields + source attribution, no IP stored.
  // Written as 'received' BEFORE the email attempt so a crash mid-send cannot
  // produce an email with no record.
  const record = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    status: 'received',
    fields: Object.fromEntries(
      FIELDS.map(([key]) => [key, key === 'work_types' ? workTypes : (data[key] ?? '')])
    ),
  };
  const storage = await saveRecord(record);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    record.status = 'email_unconfigured';
    await saveRecord(record);
    return res.status(500).json({ ok: false, error: 'Email is not configured.' });
  }

  const TO = process.env.APPLY_TO || 'hello@cleaningjobs.co.nz';
  // Resend requires the From domain to be verified. Default to a no-reply on the
  // apex; override with APPLY_FROM if you verify a subdomain instead.
  const FROM = process.env.APPLY_FROM || 'Cleaning Jobs <no-reply@cleaningjobs.co.nz>';

  const rows = FIELDS.map(([key, label]) => {
    const val = key === 'work_types' ? workTypes.join(', ') : data[key];
    if (val === undefined || val === null || val === '') return '';
    return `<tr><td style="padding:6px 12px;color:#79838f;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 12px;color:#1c2b3e;font-weight:600">${esc(val)}</td></tr>`;
  }).join('');

  // Storage outcome rides in the email so gaps in the dataset are visible immediately.
  const storageNote = storage === 'stored' ? 'record stored' : storage === 'off' ? 'record storage off' : 'RECORD STORAGE FAILED';

  const html = `<div style="font-family:Arial,Segoe UI,sans-serif;max-width:640px">
    <h2 style="color:#1d4f91;margin:0 0 4px">New cleaning application</h2>
    <p style="color:#79838f;margin:0 0 16px">Submitted via cleaningjobs.co.nz/apply/ &middot; ${esc(record.id)} &middot; ${esc(storageNote)}</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e3e0d8;border-radius:8px">${rows}</table>
  </div>`;

  const text = FIELDS.map(([key, label]) => {
    const val = key === 'work_types' ? workTypes.join(', ') : data[key];
    return val ? `${label}: ${val}` : '';
  }).filter(Boolean).join('\n') + `\n\nRecord: ${record.id} (${storageNote})`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: typeof data.email === 'string' ? data.email : undefined,
        subject: `New application — ${String(data.full_name).slice(0, 80)} (${String(data.suburb || data.region)})`,
        html,
        text,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Resend error', r.status, detail);
      record.status = 'send_failed';
      await saveRecord(record);
      return res.status(502).json({ ok: false, error: 'Could not send right now.' });
    }
    // Success = Resend ACCEPTED the message; actual delivery is a webhook concern.
    const accepted = await r.json().catch(() => null);
    record.status = 'email_accepted';
    if (accepted && typeof accepted.id === 'string') record.resend_id = accepted.id;
    await saveRecord(record);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('apply handler error', e);
    record.status = 'send_failed';
    await saveRecord(record);
    return res.status(500).json({ ok: false, error: 'Could not send right now.' });
  }
}
