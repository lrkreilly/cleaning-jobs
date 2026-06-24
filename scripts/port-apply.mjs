// Ports apply.html into src/pages/apply/index.astro (same approach as the other
// subpages): externalise <style>, decode any data:images, is:inline scripts,
// inject favicon links. Leaves the <form action> as-is for now — the backend
// is wired in a follow-up edit once the user picks a provider.
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/Luke/Downloads/apply.html';
const DEST = 'C:/code/cleaning-jobs';

const FAVICON_LINKS = `
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />`;

let html = fs.readFileSync(SRC, 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('No <style> in apply.html');
let css = styleMatch[1].trim();
html = html.replace(/\s*<style>[\s\S]*?<\/style>\s*/i, '\n');

let imgs = 0;
const extractDataImages = (str) =>
  str.replace(
    /data:image\/(jpeg|jpg|png|webp|gif|avif);base64,([A-Za-z0-9+/=\s]+?)(['")])/gi,
    (_m, ext, b64, closer) => {
      const clean = b64.replace(/\s+/g, '');
      const e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase();
      imgs += 1;
      const fname = `apply-asset-${imgs}.${e}`;
      fs.writeFileSync(path.join(DEST, 'public/images', fname), Buffer.from(clean, 'base64'));
      return `/images/${fname}${closer}`;
    }
  );
css = extractDataImages(css);
html = extractDataImages(html);

if (!/rel=["']icon["']/i.test(html)) {
  html = html.replace(/(<meta[^>]*name=["']viewport["'][^>]*>\s*)/i, `$1${FAVICON_LINKS}\n`);
}

html = html.replace(/<script(?![^>]*\bis:inline\b)/gi, '<script is:inline');

fs.mkdirSync(path.join(DEST, 'src/styles'), { recursive: true });
fs.mkdirSync(path.join(DEST, 'src/pages/apply'), { recursive: true });
fs.writeFileSync(path.join(DEST, 'src/styles/apply.css'), css + '\n', 'utf8');
const page =
  `---\n// apply — ported from apply.html (pixel-for-pixel).\nimport '../../styles/apply.css';\n---\n` +
  html.trim() + '\n';
fs.writeFileSync(path.join(DEST, 'src/pages/apply/index.astro'), page, 'utf8');
console.log(`ported apply.html -> src/pages/apply/index.astro (css ${css.length}b, page ${page.length}b, imgs ${imgs})`);
console.log('form action:', (html.match(/<form[^>]*action="([^"]*)"/) || [])[1]);
