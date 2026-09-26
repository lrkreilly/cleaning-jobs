// Runs a Vercel-style function (`export default function handler(req, res)`) inside the Worker, so
// the files in api/ keep their exact logic after the move. It builds only the parts of Vercel's
// req and res that those files use.
const INVALID_JSON = new Error('Invalid JSON');

export async function runVercelFunction(handler, request) {
  const url = new URL(request.url);
  const headers = {};
  for (const [name, value] of request.headers) headers[name.toLowerCase()] = value;
  // Vercel gave the visitor's address in x-forwarded-for; Cloudflare gives it in cf-connecting-ip.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers['x-forwarded-for'] = ip;

  const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  const type = (headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  let body;
  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams),
    // Vercel parsed the body by its content type when the function first read req.body.
    get body() { return body === undefined ? (body = parseBody(type, text)) : body; },
    set body(value) { body = value; },
    // For functions that read the stream themselves: replay the body as one chunk, then end.
    on(event, callback) {
      if (event === 'data' && text) queueMicrotask(() => callback(text));
      if (event === 'end') queueMicrotask(() => callback());
      return req;
    },
    destroy() {},
  };

  let payload = null;
  const out = new Headers();
  const res = {
    statusCode: 200,
    status(code) { res.statusCode = code; return res; },
    setHeader(name, value) { out.set(name, String(value)); return res; },
    getHeader(name) { return out.get(name); },
    json(value) {
      if (!out.has('content-type')) out.set('content-type', 'application/json; charset=utf-8');
      payload = JSON.stringify(value);
      return res;
    },
    send(value) {
      payload = value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
      return res;
    },
    end(value) {
      if (value !== undefined) payload = value;
      return res;
    },
  };
  try {
    await handler(req, res);
  } catch (error) {
    // Vercel answered a JSON body it could not parse with a bare 400, whatever the function did.
    if (error === INVALID_JSON) return new Response(null, { status: 400 });
    throw error;
  }
  return new Response(payload, { status: res.statusCode, headers: out });
}

// Vercel's parsing: JSON (an empty body as {}), a URL-encoded form (what a browser sends without
// JavaScript) as its fields, with a repeated name as a list, text as a string; anything else is
// left for the function to read.
function parseBody(type, text) {
  if (type === 'application/json') {
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw INVALID_JSON; }
  }
  if (type === 'application/x-www-form-urlencoded') {
    const fields = Object.create(null);
    for (const [name, value] of new URLSearchParams(text)) {
      fields[name] = name in fields ? [].concat(fields[name], value) : value;
    }
    return fields;
  }
  if (type === 'text/plain') return text;
  return undefined;
}
