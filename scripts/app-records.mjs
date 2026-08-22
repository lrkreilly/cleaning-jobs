// Operate on first-party application records in the KV store.
// Usage (requires KV_REST_API_URL + KV_REST_API_TOKEN in the environment):
//   node scripts/app-records.mjs list                 # newest 50 ids
//   node scripts/app-records.mjs get <id>             # print one record
//   node scripts/app-records.mjs status <id> <status> # e.g. reviewed | onboarded | allocated
//   node scripts/app-records.mjs delete <id>          # permanent removal (privacy requests)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!URL_ || !TOKEN) {
  console.error('Set KV_REST_API_URL and KV_REST_API_TOKEN first.');
  process.exit(1);
}

async function exec(commands) {
  const r = await fetch(`${URL_}/multi-exec`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`KV HTTP ${r.status}`);
  const out = await r.json();
  const bad = Array.isArray(out) ? out.find((o) => o && o.error) : out;
  if (!Array.isArray(out) || (bad && bad.error)) throw new Error(`KV error: ${JSON.stringify(bad)}`);
  return out.map((o) => o.result);
}

const [cmd, id, status] = process.argv.slice(2);
if (cmd === 'list') {
  const [ids] = await exec([['ZRANGE', 'app:index', '0', '49', 'REV']]);
  console.log((ids || []).join('\n') || '(no records)');
} else if (cmd === 'get' && id) {
  const [json] = await exec([['GET', `app:${id}`]]);
  console.log(json ? JSON.stringify(JSON.parse(json), null, 2) : '(not found — expired or deleted)');
} else if (cmd === 'status' && id && status) {
  const [json, ttl] = await exec([['GET', `app:${id}`], ['TTL', `app:${id}`]]);
  if (!json) { console.error('(not found)'); process.exit(1); }
  const record = { ...JSON.parse(json), status };
  // Preserve the remaining retention window rather than restarting it.
  const set = ttl > 0 ? ['SET', `app:${id}`, JSON.stringify(record), 'EX', String(ttl)] : ['SET', `app:${id}`, JSON.stringify(record)];
  await exec([set]);
  console.log(`status -> ${status}`);
} else if (cmd === 'delete' && id) {
  await exec([['DEL', `app:${id}`], ['ZREM', 'app:index', id]]);
  console.log('deleted');
} else {
  console.error('usage: node scripts/app-records.mjs list | get <id> | status <id> <status> | delete <id>');
  process.exit(1);
}
