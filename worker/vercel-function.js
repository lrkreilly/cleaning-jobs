// Runs a Vercel-style function (`export default function handler(req, res)`) inside the Worker, so
// the files in api/ keep their exact logic after the move. It builds only the parts of Vercel's
// req and res that those files use.
export async function runVercelFunction(handler, request) {
  const url = new URL(request.url);
  const headers = {};
  for (const [name, value] of request.headers) headers[name.toLowerCase()] = value;
  // Vercel gave the visitor's address in x-forwarded-for; Cloudflare gives it in cf-connecting-ip.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers['x-forwarded-for'] = ip;

  const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  // Vercel parsed a JSON body into req.body and left any other body as a string.
  let body;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    body,
    query: Object.fromEntries(url.searchParams),
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
      out.set('content-type', 'application/json; charset=utf-8');
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
  await handler(req, res);
  return new Response(payload, { status: res.statusCode, headers: out });
}
