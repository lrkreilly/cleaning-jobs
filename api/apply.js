// Vercel serverless function: receives an application and emails it via Resend.
// Static Astro site + a top-level /api function = Vercel deploys this at /api/apply.
// The Resend API key is read from the RESEND_API_KEY env var (set in Vercel),
// never committed. Configure the from/to via env with sensible fallbacks.

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
];

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'Email is not configured.' });

  const data = await readBody(req);
  if (!data) return res.status(400).json({ ok: false, error: 'Invalid request.' });

  // Honeypot: silently accept bot submissions without emailing.
  if (data.company) return res.status(200).json({ ok: true });

  // Minimal server-side validation (mirrors the form's required fields).
  const required = ['full_name', 'email', 'phone', 'suburb', 'region', 'right_to_work', 'experience', 'transport', 'consent'];
  for (const f of required) {
    if (!data[f] || (typeof data[f] === 'string' && !data[f].trim())) {
      return res.status(400).json({ ok: false, error: 'Please complete all required fields.' });
    }
  }
  const workTypes = [].concat(data.work_types || []).filter(Boolean);
  if (workTypes.length === 0) {
    return res.status(400).json({ ok: false, error: 'Please choose at least one type of work.' });
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
    <p style="color:#79838f;margin:0 0 16px">Submitted via cleaningjobs.co.nz/apply/</p>
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
      return res.status(502).json({ ok: false, error: 'Could not send right now.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('apply handler error', e);
    return res.status(500).json({ ok: false, error: 'Could not send right now.' });
  }
}
