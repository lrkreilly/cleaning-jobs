# Cleaning Jobs NZ

Recruitment & onboarding site for **The Spruce Company** (NZ). Cleaners apply once;
suitable applicants complete Spruce certification and become eligible for residential
and commercial work allocation.

- **Domain:** cleaningjobs.co.nz
- **Stack:** Astro (static) → GitHub → Vercel
- **Source mockup:** `Downloads/cleaningjobs-home_3_1.html` (ported pixel-for-pixel)

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/
npm run preview
```

## Notes

- The homepage is a faithful port of the approved mockup. Global styles live in
  `src/styles/global.css`; the hero/illustration assets were decoded from inline
  base64 into `public/images/`.
- To re-run the port from an updated mockup: `node scripts/port-from-mockup.mjs`.
- Inline `<script>` tags (JSON-LD, mobile menu) carry `is:inline` so Astro leaves
  them untouched.
