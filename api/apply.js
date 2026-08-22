// Vercel serverless function: receives an application, records it, and emails it via Resend.
// Static Astro site + a top-level /api function = Vercel deploys this at /api/apply
// (canonical URL is /api/apply/ under "trailingSlash": true — the form posts there directly).
// The Resend API key is read from the RESEND_API_KEY env var (set in Vercel),
// never committed. Configure the from/to via env with sensible fallbacks.
//
// First-party application record + rate limiting use an Upstash-compatible Redis REST
// store (Vercel KV / Upstash): KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_* pair).
// With no store configured both features are silently disabled, and a store failure
// never blocks the email path — conversion first.

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
  ['source_params', 'Source (URL params)'],
];

// Per-field length caps (all fields are strings from the form; anything larger is junk).
const MAX_LEN = {
  full_name: 120, email: 200, phone: 40, suburb: 120, region: 40,
  right_to_work: 60, experience: 40, transport: 40, availability: 60,
  applying_as: 60, message: 3000, consent: 10, company: 200,
  source_referrer: 500, source_params: 500,
};

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

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Run a Redis command pipeline against the REST store. Returns null on any failure.
async function kv(commands) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Sliding-hour cap per IP. Fails open: no store or store error = not limited.
async function rateLimited(ip) {
  if (!ip) return false;
  const key = `rl:${ip}`;
  const res = await kv([['INCR', key], ['EXPIRE', key, '3600', 'NX']]);
  const count = res && res[0] && typeof res[0].result === 'number' ? res[0].result : null;
  return count !== null && count > 10;
}

// Persist the application record (lifecycle: received → delivered / send_failed /
// email_unconfigured; later statuses — reviewed, onboarded, allocated — are set out of band).
async function saveRecord(record) {
  await kv([
    ['SET', `app:${record.id}`, JSON.stringify(record)],
    ['LPUSH', 'app:index', record.id],
  ]);
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

  // Type/length validation: every known field must be a string within its cap.
  for (const [field, cap] of Object.entries(MAX_LEN)) {
    const v = data[field];
    if (v !== undefined && (typeof v !== 'string' || v.length > cap)) {
      return res.status(400).json({ ok: false, error: 'Invalid request.' });
    }
  }

  // Minimal server-side validation (mirrors the form's required fields).
  const required = ['full_name', 'email', 'phone', 'suburb', 'region', 'right_to_work', 'experience', 'transport', 'consent'];
  for (const f of required) {
    if (!data[f] || (typeof data[f] === 'string' && !data[f].trim())) {
      return res.status(400).json({ ok: false, error: 'Please complete all required fields.' });
    }
  }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  const workTypes = [].concat(data.work_types || []).filter(Boolean);
  if (workTypes.length === 0) {
    return res.status(400).json({ ok: false, error: 'Please choose at least one type of work.' });
  }
  if (workTypes.length > 6 || workTypes.some((w) => typeof w !== 'string' || w.length > 40)) {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || '';
  if (await rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later, or email hello@cleaningjobs.co.nz.' });
  }

  // First-party application record: fields + source attribution, no IP stored.
  const record = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    status: 'received',
    fields: Object.fromEntries(
      FIELDS.map(([key]) => [key, key === 'work_types' ? workTypes : (data[key] ?? '')])
    ),
  };

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

  const html = `<div style="font-family:Arial,Segoe UI,sans-serif;max-width:640px">
    <h2 style="color:#1d4f91;margin:0 0 4px">New cleaning application</h2>
    <p style="color:#79838f;margin:0 0 16px">Submitted via cleaningjobs.co.nz/apply/ &middot; record ${esc(record.id)}</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e3e0d8;border-radius:8px">${rows}</table>
  </div>`;

  const text = FIELDS.map(([key, label]) => {
    const val = key === 'work_types' ? workTypes.join(', ') : data[key];
    return val ? `${label}: ${val}` : '';
  }).filter(Boolean).join('\n');

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
    record.status = 'delivered';
    await saveRecord(record);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('apply handler error', e);
    record.status = 'send_failed';
    await saveRecord(record);
    return res.status(500).json({ ok: false, error: 'Could not send right now.' });
  }
}
