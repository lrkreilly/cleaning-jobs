// Cloudflare Worker for cleaningjobs.co.nz. It serves the Astro build (./dist) as static assets and
// reproduces what Vercel sent, so the move changes no URL, status or header that matters for
// search: the HTTP, www and trailing-slash redirects, the vercel.json redirects and headers,
// charsets, caching, HSTS, CORS, the site's 404 page and Vercel's plain-text 404 under /api/.
// The application form's function, api/apply.js, runs unchanged through
// worker/vercel-function.js. docs/cloudflare-setup.md.
import apply from '../api/apply.js';
import { runVercelFunction } from './vercel-function.js';

const SITE = {
  apex: 'cleaningjobs.co.nz',
  // vercel.json "trailingSlash": true: a path without a file extension redirects to the same path
  // with a slash before anything else, /api/ paths included, even where nothing exists.
  addTrailingSlash: true,
  // vercel.json redirects, all permanent.
  redirects: {
    '/about-cleaning-jobs/': '/about/',
    '/the-benefits-of-becoming-a-cleaner/': '/how-to-become-a-cleaner/',
  },
  // The functions in api/, at their canonical slash URL.
  functions: { '/api/apply/': apply },
  // vercel.json headers for every path: on pages, files, function answers and 404s, never on
  // redirects.
  headers: {
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
};
const VERCEL_HSTS = 'max-age=63072000'; // Vercel's own, on redirects
const CACHE = 'public, max-age=0, must-revalidate';
const CHARSET_TYPES = ['text/html', 'text/plain', 'text/css', 'application/manifest+json'];
// Vercel cached everything under /_astro/ for a year, 404s included.
const cacheFor = (url) => (url.pathname.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : CACHE);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Vercel's bodies, byte for byte: its HTTPS redirect has no final newline, its others do.
    if (url.protocol === 'http:') return redirect(`https://${url.host}${url.pathname}${url.search}`, false, 'Redirecting...');
    if (url.hostname === `www.${SITE.apex}`) return redirect(`https://${SITE.apex}${url.pathname}${url.search}`, true, 'Redirecting...\n');
    if (SITE.addTrailingSlash && !url.pathname.endsWith('/') && !/\.[^/]*$/.test(url.pathname)) {
      return redirect(`${url.pathname}/${url.search}`, true, 'Redirecting...\n');
    }
    const moved = SITE.redirects[url.pathname];
    if (moved) return redirect(`${moved}${url.search}`, true, 'Redirecting...\n');

    const fn = SITE.functions[url.pathname];
    if (fn) {
      const answer = await runVercelFunction(fn, request);
      const headers = new Headers(answer.headers);
      if (!headers.has('cache-control')) headers.set('cache-control', CACHE);
      siteHeaders(headers, url);
      return new Response(answer.body, { status: answer.status, headers });
    }
    // Vercel answered unknown /api/ paths with its own text, not the site's 404 page.
    if (url.pathname.startsWith('/api/')) return plainNotFound(url);

    const asset = await env.ASSETS.fetch(request);
    // The asset layer answers /about/index.html with a temporary 307 to /about/, the canonical
    // URL. Make it permanent and keep any query string.
    if (asset.status === 307 && asset.headers.has('location')) {
      const target = new URL(asset.headers.get('location'), url);
      if (!target.search) target.search = url.search;
      return redirect(target.pathname + target.search, true, 'Redirecting...\n');
    }
    // Pages, files and the site's own 404 page (status 404) carry the same headers.
    const headers = new Headers(asset.headers);
    // Cloudflare stores each file's type at upload without a charset; Vercel sent one.
    const type = headers.get('content-type');
    if (CHARSET_TYPES.includes(type)) headers.set('content-type', `${type}; charset=utf-8`);
    headers.set('cache-control', cacheFor(url));
    headers.set('access-control-allow-origin', '*');
    siteHeaders(headers, url);
    return new Response(asset.body, { status: asset.status, headers });
  },
};

function siteHeaders(headers, url) {
  headers.set('strict-transport-security', VERCEL_HSTS);
  // Vercel never applied vercel.json's headers under /.well-known/.
  if (url.pathname.startsWith('/.well-known/')) return;
  for (const [name, value] of Object.entries(SITE.headers)) headers.set(name, value);
}

// Vercel's own plain-text 404, with the site's headers. Its body ends with a request id, which has
// no equivalent here.
function plainNotFound(url) {
  const headers = new Headers({ 'content-type': 'text/plain; charset=utf-8', 'cache-control': cacheFor(url) });
  siteHeaders(headers, url);
  return new Response('The page could not be found\n\nNOT_FOUND\n', { status: 404, headers });
}

// The 308 Vercel sent: a short text body and a Refresh header, and over HTTPS its caching and
// HSTS headers (HSTS means nothing over plain HTTP).
function redirect(location, secure, body) {
  const headers = { 'content-type': 'text/plain', location, refresh: `0;url=${location}` };
  if (secure) Object.assign(headers, { 'cache-control': CACHE, 'strict-transport-security': VERCEL_HSTS });
  return new Response(body, { status: 308, headers });
}
