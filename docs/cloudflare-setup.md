# Cloudflare setup

cleaningjobs.co.nz is served by the Cloudflare Worker `cleaning-jobs` (account "Reilly Family") since 2026-09-26. It replaced Vercel.

## Publishing

1. Commit and push to `main`.
2. From an up-to-date checkout of `main`, run `npm run deploy` (`astro build`, then `wrangler deploy`; run `npm ci` first if Wrangler is not installed). Pushing alone does not publish.
3. Check the changed pages on https://cleaningjobs.co.nz. `npx wrangler deployments status` shows the live version.

Wrangler must be logged in (`npx wrangler login`) to the account that owns the Worker.

## What serves the site

- `wrangler.jsonc`: the build in `dist/` as static assets, every request through `worker/index.js`, no `workers.dev` or preview addresses (they would publish duplicate copies), and the Custom Domains `cleaningjobs.co.nz` and `www.cleaningjobs.co.nz`. A deploy replaces the Worker's whole list of Custom Domains with the one in this file.
- `worker/index.js` reproduces what Vercel sent: HTTP, `www` and trailing-slash redirects (308); the redirects from `/about-cleaning-jobs/` and `/the-benefits-of-becoming-a-cleaner/`; the security headers and CSP from `vercel.json`; `charset=utf-8` on text; a year's caching for `/_astro/`; the site's 404 page, and Vercel's plain-text 404 under `/api/`. One change from Vercel: `/x/index.html` redirects permanently to `/x/`, where Vercel served a duplicate page.
- The application form posts to `/api/apply/`, where `api/apply.js` runs unchanged through `worker/vercel-function.js`. The adapter reads request bodies as Vercel did: JSON from the page's script, and form fields from a browser that runs without JavaScript.
- `vercel.json` now configures only the Vercel copy, kept for rollback until Vercel is retired. The live rules are in `worker/index.js`; while Vercel is kept, change both.
- `.gitattributes` checks text out with LF, so a build on Windows publishes the same bytes as one on Linux.
- `npm run compare:hosts` compares two hosts file by file (usage at the top of `scripts/compare-hosts.mjs`).

## Secrets

`api/apply.js` reads these from the Worker's secrets, set with `npx wrangler secret put <NAME>` (a secret takes effect at once):

- `RESEND_API_KEY`: needed to send applications. Not set as of 2026-09-26; Vercel had none either, so the form answers "Email is not configured." and the page shows the email and phone fallback.
- Optional: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (an Upstash store, for application records and rate limiting), `APP_RECORD_TTL_DAYS` (records are kept only when it is set), `APPLY_TO` and `APPLY_FROM`.

## DNS (zone cleaningjobs.co.nz)

- The apex and `www` records belong to the Worker's Custom Domains. Cloudflare manages them and their certificates; do not edit them by hand.
- Keep the Outlook MX record, the TXT records (`google-site-verification`, SPF), and Resend's records: the `resend._domainkey` TXT and the `send` MX and TXT.

## The move (2026-09-26)

- On the test hostname `cf-check.cleaningjobs.co.nz`, the comparison with Vercel's copy found 0 problems in 93 checks, and the form endpoint gave Vercel's answers to the same requests.
- Codex deleted the apex and `www` CNAMEs to Vercel, keeping screenshots of them as the rollback record. The records were gone by 13:57:24 NZST and the Custom Domains were attached at 13:58:03. A 95-check comparison against Vercel's copy found 0 problems, the live form gave Vercel's answers, and 8 of 8 outside networks loaded the site.
- Rollback while Vercel keeps the project and domains: remove the Worker's Custom Domains (Settings, Domains & Routes), then recreate the two CNAMEs from the screenshots.
