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

// ---- Favicon mark: the brand "C" (improved vector of Cleaning (2).png) ----
// A bold geometric C in brand blue, opening to the right, on a soft rounded
// square so it stays legible on both light and dark browser tab strips.
// Built as crisp SVG so it's razor-sharp at every size (32 → 512).
const C_GLYPH = `<path d="M 374.2 163.6 A 150 150 0 1 0 374.2 348.4"
    fill="none" stroke="${PRIMARY}" stroke-width="82" stroke-linecap="round"/>`;

// On-tab icon: white rounded square + blue C (matches the supplied blue-on-light mark).
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="104" fill="#ffffff"/>
  ${C_GLYPH}
</svg>`;

// Maskable / standalone scalable favicon (served as /favicon.svg).
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="104" fill="#ffffff"/>
  ${C_GLYPH}
</svg>
`;
writeFileSync('public/favicon.svg', faviconSvg);
console.log('icon: favicon.svg (vector)');

// Multi-resolution favicon.ico (16/32/48) packed from PNGs of the C.
// Google's favicon crawler probes /favicon.ico directly, so we ship a real one.
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const sizes = [16, 32, 48];
  pngBuffers.forEach((png, i) => {
    const s = sizes[i];
    const b = i * 16;
    dir[b] = s >= 256 ? 0 : s;       // width (0 = 256)
    dir[b + 1] = s >= 256 ? 0 : s;   // height
    dir[b + 2] = 0;                  // palette
    dir[b + 3] = 0;                  // reserved
    dir.writeUInt16LE(1, b + 4);     // color planes
    dir.writeUInt16LE(32, b + 6);    // bits per pixel
    dir.writeUInt32LE(png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...pngBuffers]);
}
writeFileSync('public/favicon.ico', buildIco([render(iconSvg, 16), render(iconSvg, 32), render(iconSvg, 48)]));
console.log('icon: favicon.ico (16/32/48)');

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
    <rect width="64" height="64" rx="16" fill="#ffffff" stroke="#e3e0d8" stroke-width="1.5"/>
    <path d="M 46.8 20.5 A 18.75 18.75 0 1 0 46.8 43.5" fill="none" stroke="${PRIMARY}" stroke-width="10.25" stroke-linecap="round" transform="translate(0,0)"/>
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
