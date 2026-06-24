// Ports the 3 supplied subpage mockups into Astro pages, same approach as the
// homepage porter: externalise <style> -> per-page CSS, decode any base64
// data:images -> public/images/, add is:inline to all <script>, and inject the
// favicon <link> set (the mockups only ship og:image). Output uses Astro's
// directory routing so the canonical trailing-slash URLs resolve:
//   how-it-works.html -> src/pages/how-it-works/index.astro  -> /how-it-works/
//   about.html        -> src/pages/about/index.astro         -> /about/
//   faq.html          -> src/pages/faq/index.astro           -> /faq/
import fs from 'node:fs';
import path from 'node:path';

const SRCDIR = 'C:/Users/Luke/Downloads/cleaningjobs_pages';
const DEST = 'C:/code/cleaning-jobs';

const PAGES = [
  { src: 'how-it-works.html', route: 'how-it-works', css: 'how-it-works' },
  { src: 'about.html', route: 'about', css: 'about' },
  { src: 'faq.html', route: 'faq', css: 'faq' },
];

const FAVICON_LINKS = `
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />`;

fs.mkdirSync(path.join(DEST, 'public/images'), { recursive: true });

let totalImgs = 0;
for (const p of PAGES) {
  let html = fs.readFileSync(path.join(SRCDIR, p.src), 'utf8');

  // 1. Externalise the <style> block.
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  if (!styleMatch) throw new Error(`No <style> in ${p.src}`);
  let css = styleMatch[1].trim();
  html = html.replace(/\s*<style>[\s\S]*?<\/style>\s*/i, '\n');

  // 2. Decode base64 data:images (shared filenames across pages are fine — same bytes).
  const extractDataImages = (str) =>
    str.replace(
      /data:image\/(jpeg|jpg|png|webp|gif|avif);base64,([A-Za-z0-9+/=\s]+?)(['")])/gi,
      (_m, ext, b64, closer) => {
        const clean = b64.replace(/\s+/g, '');
        const e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase();
        totalImgs += 1;
        const fname = `${p.css}-asset-${totalImgs}.${e}`;
        fs.writeFileSync(path.join(DEST, 'public/images', fname), Buffer.from(clean, 'base64'));
        return `/images/${fname}${closer}`;
      }
    );
  css = extractDataImages(css);
  html = extractDataImages(html);

  // 3. Inject favicon links right after <meta name="viewport"> if not already present.
  if (!/rel=["']icon["']/i.test(html)) {
    html = html.replace(
      /(<meta[^>]*name=["']viewport["'][^>]*>\s*)/i,
      `$1${FAVICON_LINKS}\n`
    );
  }

  // 4. Keep Astro's hands off inline scripts (JSON-LD + menu/FAQ IIFEs).
  html = html.replace(/<script(?![^>]*\bis:inline\b)/gi, '<script is:inline');

  // 5. Write per-page CSS + the Astro page.
  fs.writeFileSync(path.join(DEST, `src/styles/${p.css}.css`), css + '\n', 'utf8');
  fs.mkdirSync(path.join(DEST, `src/pages/${p.route}`), { recursive: true });
  const page =
    `---\n` +
    `// ${p.route} — ported from ${p.src} (pixel-for-pixel).\n` +
    `import '../../styles/${p.css}.css';\n` +
    `---\n` +
    html.trim() + '\n';
  fs.writeFileSync(path.join(DEST, `src/pages/${p.route}/index.astro`), page, 'utf8');
  console.log(`ported ${p.src} -> src/pages/${p.route}/index.astro  (css ${css.length}b, page ${page.length}b)`);
}
console.log('images extracted:', totalImgs);
