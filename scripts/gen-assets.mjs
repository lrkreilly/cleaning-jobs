// Generates favicons + the homepage OG image from brand-coloured SVGs.
// resvg-js loads system fonts (Segoe UI on Windows) so OG text renders reliably.
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const PRIMARY = '#1d4f91';
const PRIMARY_DARK = '#163c70';
const CREAM = '#f7f5f0';
const INK = '#1c2b3e';
const MUTED = '#79838f';
const ACCENT = '#e0922f';

mkdirSync('public', { recursive: true });
mkdirSync('public/og', { recursive: true });

const render = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } })
    .render()
    .asPng();

// ---- Favicon mark: blue rounded square + white "cleaning bubbles" ----
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${PRIMARY}"/>
  <circle cx="206" cy="214" r="78" fill="#ffffff"/>
  <circle cx="316" cy="178" r="46" fill="#ffffff" opacity="0.92"/>
  <circle cx="322" cy="298" r="58" fill="#ffffff" opacity="0.82"/>
  <circle cx="220" cy="214" r="20" fill="${PRIMARY}" opacity="0.18"/>
</svg>`;

for (const [name, size] of [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(`public/${name}`, render(iconSvg, size));
  console.log('icon:', name, size);
}

// ---- OG card 1200x630 ----
const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect width="1200" height="14" fill="${ACCENT}"/>
  <g transform="translate(80,96)">
    <rect width="64" height="64" rx="16" fill="${PRIMARY}"/>
    <circle cx="26" cy="28" r="13" fill="#fff"/>
    <circle cx="44" cy="22" r="8" fill="#fff" opacity="0.9"/>
    <circle cx="44" cy="40" r="10" fill="#fff" opacity="0.82"/>
    <text x="84" y="42" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="${INK}">CleaningJobs</text>
  </g>
  <text x="80" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="40" letter-spacing="3" fill="${MUTED}">CLEANING JOBS · NEW ZEALAND</text>
  <text x="78" y="380" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="${INK}">Cleaning work, made clearer.</text>
  <text x="80" y="450" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="${MUTED}">Apply once. Complete Spruce certification.</text>
  <text x="80" y="496" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="${MUTED}">Become eligible for work allocation.</text>
  <rect x="80" y="556" width="1040" height="2" fill="#e3e0d8"/>
  <text x="80" y="600" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="${PRIMARY}">cleaningjobs.co.nz</text>
  <text x="1120" y="600" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="${MUTED}">The recruitment arm of Spruce</text>
</svg>`;

writeFileSync('public/og/home.png', render(ogSvg, 1200));
console.log('og: public/og/home.png 1200x630');
