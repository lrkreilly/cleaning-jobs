// Standalone "C" logo set, built from the exact favicon geometry.
// Outputs crisp SVG masters + high-res PNGs into public/logo/ (and brand/ on disk).
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const PRIMARY = '#1d4f91';
const WHITE = '#ffffff';

mkdirSync('public/logo', { recursive: true });

// Same arc as the favicon: a bold geometric C opening to the right in a 512 box.
const cPath = (stroke) =>
  `<path d="M 374.2 163.6 A 150 150 0 1 0 374.2 348.4" fill="none" stroke="${stroke}" stroke-width="82" stroke-linecap="round"/>`;

// --- Variants ---
// 1. Glyph only, transparent background, blue C — the primary logo.
const glyphBlue = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${cPath(PRIMARY)}</svg>\n`;
// 2. Glyph only, transparent, white C — for dark backgrounds.
const glyphWhite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${cPath(WHITE)}</svg>\n`;
// 3. Badge: blue C on white rounded square (matches favicon exactly).
const badgeLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="${WHITE}"/>${cPath(PRIMARY)}</svg>\n`;
// 4. Badge reversed: white C on blue rounded square.
const badgeDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="${PRIMARY}"/>${cPath(WHITE)}</svg>\n`;

const VARIANTS = [
  ['c-logo',            glyphBlue],   // primary: blue C, transparent
  ['c-logo-white',      glyphWhite],  // white C, transparent
  ['c-badge-light',     badgeLight],  // blue C on white square
  ['c-badge-dark',      badgeDark],   // white C on blue square
];

// PNG export sizes (transparent where the SVG is transparent).
const SIZES = [256, 512, 1024, 2048];

for (const [name, svg] of VARIANTS) {
  writeFileSync(`public/logo/${name}.svg`, svg);
  for (const size of SIZES) {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng();
    writeFileSync(`public/logo/${name}-${size}.png`, png);
  }
  console.log('logo:', name, '(svg +', SIZES.join('/'), 'png)');
}
console.log('done -> public/logo/');
