# cleaningjobs.co.nz — SEO Plan v2.1 (head-term first)

> v2.1, 2026-08-22. v2 set the strategy (head term as North Star, Auckland page rebuild) after
> Luke reversed v1's lattice-first approach. v2.1 folds in Luke's implementation review: a
> broken conversion path and several factual/technical corrections now precede the rebuild.
> All review claims were independently verified before inclusion (live endpoint tests, source
> reads, `npm audit`) on 2026-08-22. v1 and v2 are preserved as artifact versions.

---

## North Star

**Make `/cleaning-jobs-auckland/` the best employer-owned result for "cleaning jobs auckland"
and reach page one.** Every supporting page, article, link, and technical change is evaluated by
one test: does it strengthen that URL, or produce qualified Auckland applications?

No promised date for top three; page one is a legitimate objective and the plan behaves like it
intends to win. The exact-match domain is a useful relevance cue, not a strategic moat — the
page has to earn the position on substance.

**Execution order (the whole plan in one line):** restore applications → correct claims and
privacy/data handling → establish measurement and indexation → rebuild the Auckland page →
contextual Spruce links → supporting pages and outreach → publish the data asset.

---

## Step 0 — restore conversion and truth (before any SEO work)

SEO that routes people to a broken or overstated funnel is wasted. All items verified 2026-08-22.

| # | Item | Verified state | Fix |
|---|------|----------------|-----|
| 1 | **Production applications fail.** | Live POST to `/api/apply/` returns `500 {"error":"Email is not configured."}` — `RESEND_API_KEY` is absent (`api/apply.js:47`). Every application since deployment has been lost. | Configure `RESEND_API_KEY`, `APPLY_FROM`, `APPLY_TO` in Vercel (Luke — credentials), confirm the cleaningjobs.co.nz sending domain is verified in Resend, redeploy, run an end-to-end delivery test. |
| 2 | **Empty red error banner on the form.** | `apply/index.astro:128` ships `class="form-msg error"`; `apply.css:823–824` makes `.form-msg.error` visible — an empty red box renders on load. | Remove `error` from the initial markup (JS adds it on failure), or add a `.form-msg:empty { display:none }` guard. |
| 3 | **Unverified "Live" demand claims.** | Homepage badges all four cities "Live" (`index.astro:368`) while this plan parks three of them. | Verify each claim against actual allocated work; where "Live" cannot be substantiated, replace with truthful, dated statuses ("Applications open", "Register interest"). |
| 4 | **Privacy notice gaps.** | `/legal/` names "Cleaning Jobs — the recruitment arm of The Spruce Company" (not the registered legal entity), does not name the email processor (Resend) while naming Vercel/Cloudflare, and keeps unsuccessful applicants' details indefinitely on an opt-out basis (`legal/index.astro:129,176,197`). The Privacy Commissioner's recruitment guidance says destroy unsuccessful applications unless prior consent to retain. | Name the actual legal entity; disclose Resend as a processor; replace indefinite retention with a defined period plus an explicit future-opportunities consent (e.g. an opt-in checkbox on the form, with automatic deletion after the stated period). |
| 5 | **API hardening.** | Done 2026-08-22: per-field type/length caps, exact enum allowlists for every select/checkbox value, consent must equal the browser's checked value, KV-backed per-IP rate limit (atomic INCR+EXPIRE), and a 26-case handler test suite (`npm test`) with mocked Resend/KV. | Remaining: delivery monitoring via a Resend `email.delivered` webhook (the `delivered` status is reserved for it). |
| 6 | **Dependency advisories.** | `npm audit fix` applied 2026-08-22: 8 advisories (7 high) down to 3 (1 low, 2 high). The remainder spans Astro XSS/SSRF, esbuild, and sharp/libvips advisories. | The controlled Astro 7 upgrade (with build + regression testing) resolves the remainder — scheduled work, not a forced bump. |
| 7 | **Indexation baseline.** | Public index checks surface the homepage but not the Auckland URL (warning only). | Verify Search Console property; URL-Inspect `/cleaning-jobs-auckland/`; submit sitemap; confirm www consolidation. Establish the measurement baseline (§7) before the rebuild so movement is attributable. |

**Resolved question — form action (correction to v2):** `/api/apply/` is canonical. Verified
live: `/api/apply` 308s **to** `/api/apply/`, which answers directly. The form's existing
`action="/api/apply/"` is correct; v2's "fix" was backwards and is withdrawn. Do not change it.

### Application measurement (part of Step 0, feeds everything)

Do not use the Resend inbox as the conversion system. Store a **first-party application
record** with source attribution and lifecycle statuses: received → email_accepted →
reviewed → onboarded → allocated (`delivered` is reserved for an authenticated Resend
delivery webhook — Resend's success response only means the message was accepted for
sending). Implemented 2026-08-22 in `api/apply.js`: records persist `received` **before**
the send, carry the Resend email id, expire on a retention TTL with atomic writes and index
pruning, and stamp the storage outcome into the notification email so gaps are loud.
Source capture is allowlisted (`from`/`utm_source`/`utm_medium`/`utm_campaign` + referrer
path only). **Activation is deliberately double-gated**: recording starts only when both
the KV store env AND `APP_RECORD_TTL_DAYS` are set — the retention decision must precede
any stored personal data. Operate records with `scripts/app-records.mjs`
(list/get/status/delete). This record is the raw material for the Pay & Demand Report (§5)
and the outcome numbers on the Auckland page (§2).

Also: pass context into `/apply/` — preselect the region from the referring city page
(`/apply/?from=auckland`), and retain landing page, referrer, and UTM data in hidden fields.

---

## 1. Why the head term is winnable

SEEK, Indeed, Trade Me and Jora hold page one because they answer the query — current jobs,
pay, locations, hours, employers — not because Google has reserved it for them. Live results
show hundreds of active Auckland opportunities; that is the intent gap to close, not a wall.

**The actual blocker is our own page.** `/cleaning-jobs-auckland/` says applicants may be
"considered" or "become eligible", with undated, unsupported claims ("largest market", "steady
demand", "steady construction activity") — and none of: current intake status, pay or
rate-setting detail, likely hours, employment/contractor detail, onboarding timeframe, specific
demand locations, testimonials, or evidence that applications turn into paid work. An
expression-of-interest page cannot outrank live inventory; a page that closes those eight gaps
can compete.

---

## 2. The Auckland page rebuild

The eight gaps are the page spec. Every block ships only when the underlying fact is true and
supplied — the page's credibility is the strategy.

| Gap | What the rebuilt page publishes | Input (§8) |
|---|---|---|
| Intake status | Dated, plain statement of what we are actively onboarding for right now; updated whenever it genuinely changes (this is the freshness signal — no calendar copy). | #1 |
| Pay | Real rates or ranges, or a truthful explanation of how pay is set. | #2 |
| Hours & schedules | The shifts and patterns actually allocated. | #3 |
| Arrangement | The real employment/contractor arrangement in plain language. | #4 |
| Onboarding timeframe | Typical time from application to first paid work, as a range. | #5 |
| Demand locations | Suburbs where demand is real now — from allocation data, not a static list. | #6 |
| Testimonials | Real, consented cleaner quotes. | #7 |
| Outcomes | **Meaningful measures where sample sizes make them honest**: typical time to first paid allocation, allocation rate, repeat allocation, actual hours/work types — not vanity counts. | #8 |

Honest intake language stays ("work is not guaranteed"), paired with real status and numbers.
On-page basics get one line: the title and H1 plainly say what the page is; no keyword
formulas, no word-count targets.

---

## 3. Authority

1. **Spruce contextual links — DONE 2026-08-23** (Luke-approved architecture, Spruce commit
   `37080a2`): sprucehome.co.nz/work-with-us/ bridge page (complete answer, not a pass-through)
   linking `/cleaning-jobs-auckland/` and `/apply/`; sitewide footer "Work with Spruce";
   About-page sentence linking cleaningjobs.co.nz; franchise-page mention link-ified; and an
   Auckland-only recruiting module on Spruce's Auckland hub (data-gated in `cities.js` — other
   cities get it only after demand verification). All followed editorial links.
2. **Independent link acquisition, run as a campaign, not a direction.** It needs: an owner;
   a prospect list (training organisations, employment/community partners such as
   work-readiness programmes and migrant settlement services, industry suppliers, operators,
   local publications — West Auckland outlets first, Westgate being home turf); an outreach
   proposition (the Pay & Demand Report and the local-employer story); a cadence (e.g. a
   fixed number of contacts per month); and a measurable target (e.g. a set number of quality
   referring domains per quarter). Parameters set with Luke at kick-off.
3. **Legacy redirect recovery**: repoint Cloudflare row 57
   (`sprucecleaning.nz/how-to-become-a-cleaner/`, currently landing on an empty articles hub)
   at a rebuilt support article here; add `vercel.json` 301s for this domain's own indexed
   legacy URLs (`/about-cleaning-jobs/` → `/about/`, `/the-benefits-of-becoming-a-cleaner/` →
   the support article once live).

**Schema:** `parentOrganization` is the sole cross-entity link — never cross-org `sameAs`
(it asserts identity; the organizations are distinct). Otherwise plumbing only: `Organization`,
`WebSite` with `name`, `BreadcrumbList` with a visible trail, honest `dateModified`, `Article`
on articles. No `JobPosting` markup on talent-pool pages (genuine individual postings only —
and Google's jobs surface does not operate in NZ; neither fact bears on normal organic ranking).

---

## 4. Supporting pages

All four shipped 2026-08-22: `/cleaning-jobs-no-experience/`, `/part-time-cleaning-jobs-auckland/`,
`/cleaning-jobs-west-auckland/`, `/cleaning-jobs-south-auckland/` — written strictly from
established facts (published suburb lists, form fields, the five-stage process, sourced Tahatū
claims); no demand or pay claims. They gain their gated blocks (local demand status, pay) when
the §8 inputs arrive.

**Gate: each page ships when it has (a) verified distinct demand and (b) genuinely unique
information to publish** — real demand-area data, an audience-specific answer the Auckland hub
does not already give. Not gated solely on the hub's ranking (a hard top-20 gate could block
the supporting coverage that helps the hub get there); sequenced after the rebuild so the hub
is the strongest page first. The wider lattice, Christchurch, and the W/H/T expansion stay
parked pending evidence. Three genuinely useful pages beat eighteen templated ones.

---

## 5. The data asset

**The Auckland Cleaning Pay & Demand Report** — from the first-party application/allocation
records (Step 0), with methodology safeguards: a defined reporting period; minimum sample
sizes before any figure is published; privacy thresholds (no cell small enough to identify a
person); anonymisation; and stated caveats — in particular, **applicant locations are evidence
of applicant supply, not employer demand**; demand claims come from allocation records only.
Updated when a real data period completes.

One asset, three jobs: substance behind the Auckland page's pay/demand blocks, the outreach
proposition for §3.2, and something no aggregator can copy. The only other article kept:
"How to become a cleaner in NZ" (the redirect-recovery target). Future articles must pass the
North-Star test.

---

## 6. Housekeeping (engineering, not strategy)

Done 2026-08-22: shared layout extracted (`src/layouts/BaseLayout.astro` + `src/components/logos.js`;
duplicate city/subpage CSS consolidated; `gen-cities.mjs` retired from the workflow) · custom 404 ·
sitemap `lastmod` removed · city title-tag cleanup · legacy 301s live, with
`/the-benefits-of-becoming-a-cleaner/` now pointing at `/how-to-become-a-cleaner/`.
Still open: repoint the sprucecleaning.nz Cloudflare redirect (row 57) at
`/how-to-become-a-cleaner/` (Luke — Cloudflare access) · when convenient: per-page OG images,
`llms.txt`, IndexNow.

---

## 7. Measurement

- **Head cluster in Search Console, segmented** — by query group, country, and device;
  URL-level impressions and CTR alongside position (average position alone is too noisy);
  paired with a neutral third-party rank tracker. Milestones: indexed → top 50 → top 20 →
  page one → top five.
- **Conversion**: qualified Auckland applications per week from the first-party record
  (Step 0), by source page — the business metric that outranks any ranking metric.
- **Monthly review**: expansion decisions on evidence, not calendar.

---

## 8. Required inputs (the critical path)

| # | Input | Feeds |
|---|---|---|
| 0 | Vercel env config (`RESEND_API_KEY`, `APPLY_FROM`, `APPLY_TO`) + Resend domain verification — Luke, credentials | Step 0.1 |
| 1 | Current intake/demand status + who keeps it current | Intake block |
| 2 | Publishable rates/ranges, or the truthful rate-setting explanation | Pay block, report |
| 3 | Hours and schedule patterns actually allocated | Hours block |
| 4 | The real employment/contractor arrangement wording | Arrangement block |
| 5 | Typical application → first-paid-work timeframe | Onboarding block |
| 6 | Suburbs with genuine current demand (from allocation records) | Demand block, supporting pages |
| 7 | Cleaner testimonials with consent | Testimonials block |
| 8 | Outcome data access (applications/onboarding/allocation) | Outcomes block, report |
| 9 | Retention period + legal entity confirmation for the privacy notice | Step 0.4 |
| 10 | ~~Spruce link placements~~ done 2026-08-23; still open: link-campaign owner and targets | §3 |
