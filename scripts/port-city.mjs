// Ports a city landing HTML into src/pages/<slug>/index.astro
// Same approach as the other porters: externalise <style> -> per-page CSS,
// decode data:images, is:inline scripts, inject favicon links.
// Usage: node scripts/port-city.mjs <srcfile> <slug> <cssname>
import fs from 'node:fs';
import path from 'node:path';

const [srcArg, slug, cssName] = process.argv.slice(2);
if (!srcArg || !slug || !cssName) {
  console.error('usage: node scripts/port-city.mjs <srcfile> <slug> <cssname>');
  process.exit(1);
}
const DEST = 'C:/code/cleaning-jobs';
const SRC = path.isAbsolute(srcArg) ? srcArg : path.join('C:/Users/Luke/Downloads', srcArg);

const FAVICON_LINKS = `
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />`;

let html = fs.readFileSync(SRC, 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error(`No <style> in ${SRC}`);
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
      const fname = `${cssName}-asset-${imgs}.${e}`;
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
fs.mkdirSync(path.join(DEST, `src/pages/${slug}`), { recursive: true });
fs.writeFileSync(path.join(DEST, `src/styles/${cssName}.css`), css + '\n', 'utf8');
const page =
  `---\n// ${slug} — ported from ${path.basename(SRC)} (pixel-for-pixel).\nimport '../../styles/${cssName}.css';\n---\n` +
  html.trim() + '\n';
fs.writeFileSync(path.join(DEST, `src/pages/${slug}/index.astro`), page, 'utf8');
console.log(`ported ${path.basename(SRC)} -> src/pages/${slug}/index.astro (css ${css.length}b, page ${page.length}b, imgs ${imgs})`);
