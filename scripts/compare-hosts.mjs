// Compares two hosts serving the same site, file by file and read-only: every page and file in ./dist
// (bytes and the headers that matter), the slash and index.html variants of each page, unknown
// paths, the sitemap alias, HEAD, and the HTTP (and with --www, www) redirects.
// usage: node scripts/compare-hosts.mjs --candidate <https://host[@address]> --production <https://host[@address]> [--www]
// `host@address` sends requests to that address under the host's name, for example Vercel's
// address after the switch: --production https://datum.nz@216.150.1.1
import { request as httpsRequest, Agent as HttpsAgent } from 'node:https';
import { request as httpRequest, Agent as HttpAgent } from 'node:http';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? undefined : argv[i + 1]; };
const side = (spec) => {
  if (!spec) throw new Error('usage: --candidate <https://host[@address]> --production <https://host[@address]> [--www]');
  const [origin, address] = spec.split('@');
  // Each side keeps its own connections: with one shared pool, a request for the same host name
  // could reuse a connection already open to the other side's address.
  return { host: new URL(origin).hostname, address, agents: { https: new HttpsAgent({ keepAlive: true }), http: new HttpAgent({ keepAlive: true }) } };
};
const candidate = side(arg('candidate'));
const production = side(arg('production'));
const HEADERS = ['content-type', 'cache-control', 'strict-transport-security', 'access-control-allow-origin', 'x-robots-tag', 'link'];

function get(target, path, { method = 'GET', scheme = 'https', host = target.host } = {}) {
  return new Promise((resolve, reject) => {
    const family = target.address?.includes(':') ? 6 : 4;
    const lookup = target.address && ((_name, options, cb) => (options?.all ? cb(null, [{ address: target.address, family }]) : cb(null, target.address, family)));
    const req = (scheme === 'https' ? httpsRequest : httpRequest)(
      { host, servername: host, path, method, lookup, agent: target.agents[scheme], timeout: 20000, headers: { 'user-agent': 'compare-hosts' } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${host}${path}`)));
    req.on('error', reject);
    req.end();
  });
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out.push(...(e.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const built = (await walk(dist)).map((p) => relative(dist, p).split(sep).join('/'));
const pages = built.filter((f) => f.endsWith('index.html')).map((f) => `/${f.slice(0, -'index.html'.length)}`);
const files = built.filter((f) => !f.endsWith('index.html') && f !== '404.html').map((f) => `/${f}`);

// Each check: what to request, and the answer the candidate may give instead of production's.
const checks = [
  ...pages.map((p) => ({ path: p })),
  ...files.map((p) => ({ path: p })),
  ...pages.flatMap((p) => [
    ...(p === '/' ? [] : [{ path: p.slice(0, -1), accept: { status: 308, location: p } }]),
    { path: `${p}index.html`, accept: { status: 308, location: p } },
  ]),
  { path: '/about?utm_source=x', accept: { status: 308, location: '/about/?utm_source=x' } },
  { path: '/zz-compare-missing/' }, { path: '/zz-compare-missing' }, { path: '/_astro/zz-compare-missing.js' },
  { path: '/sitemap.xml' },
  { path: '/', method: 'HEAD' },
  { path: '/about/?x=1', scheme: 'http' },
  ...(argv.includes('--www') ? [{ path: '/about/?x=1', host: `www.${production.host}` }, { path: '/about/?x=1', host: `www.${production.host}`, scheme: 'http' }] : []),
];

const strip = (location, host) => location?.replace(new RegExp(`^https?://${host.replace(/\./g, '\\.')}`), '');
// Vercel's own 404 text ends with its request id; compare it without that line.
const VERCEL_404 = /^(The page could not be found\n\nNOT_FOUND\n)\n[a-z0-9]+::[a-z0-9:-]+\n?$/;
// A sitemap's <lastmod> values are the time of the build that wrote it, so any two builds differ.
const LASTMOD = /<lastmod>[^<]*<\/lastmod>/g;
const hash = (b) => createHash('sha256').update(b.toString('latin1').replace(VERCEL_404, '$1').replace(LASTMOD, '<lastmod/>'), 'latin1').digest('hex');
const problems = [];
const accepted = [];
let next = 0;
async function worker() {
  while (next < checks.length) {
    const c = checks[next++];
    const label = `${c.method ?? 'GET'} ${c.scheme ?? 'https'}://${c.host ?? '<host>'}${c.path}`;
    const opts = { method: c.method, scheme: c.scheme };
    const [cand, prod] = await Promise.all([
      get(candidate, c.path, { ...opts, host: c.host ?? candidate.host }),
      get(production, c.path, { ...opts, host: c.host ?? production.host }),
    ]);
    const cLoc = strip(cand.headers.location, c.host ?? candidate.host);
    const pLoc = strip(prod.headers.location, c.host ?? production.host);
    if (c.accept && prod.status === 200 && cand.status === c.accept.status && cLoc === c.accept.location) {
      accepted.push(`${label}: production 200, candidate ${cand.status} -> ${cLoc}`);
      continue;
    }
    const diffs = [];
    if (cand.status !== prod.status) diffs.push(`status ${cand.status} vs ${prod.status}`);
    if (cLoc !== pLoc) diffs.push(`location ${cLoc} vs ${pLoc}`);
    for (const h of HEADERS) if ((cand.headers[h] ?? '') !== (prod.headers[h] ?? '')) diffs.push(`${h} "${cand.headers[h] ?? ''}" vs "${prod.headers[h] ?? ''}"`);
    if (c.method !== 'HEAD' && hash(cand.body) !== hash(prod.body)) diffs.push(`body ${cand.body.length} vs ${prod.body.length} bytes`);
    if (diffs.length) problems.push(`${label}: ${diffs.join('; ')}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

console.log(`compare-hosts: ${checks.length} checks, candidate ${candidate.host}${candidate.address ? `@${candidate.address}` : ''} vs production ${production.host}${production.address ? `@${production.address}` : ''}`);
console.log(`  ${pages.length} pages and ${files.length} files from dist/`);
console.log(`  same: ${checks.length - problems.length - accepted.length}, accepted differences: ${accepted.length}, problems: ${problems.length}`);
if (accepted.length) console.log(`accepted (the candidate redirects permanently to the canonical URL; production served a duplicate):\n  ${accepted.slice(0, 5).join('\n  ')}${accepted.length > 5 ? `\n  ...and ${accepted.length - 5} more` : ''}`);
if (problems.length) console.log(`problems:\n  ${problems.join('\n  ')}`);
for (const t of [candidate, production]) Object.values(t.agents).forEach((a) => a.destroy());
process.exit(problems.length ? 1 : 0);
