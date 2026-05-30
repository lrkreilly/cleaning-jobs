// Deterministic porter: turns the verified single-file mockup into a clean Astro page.
// - Extracts <style> -> src/styles/global.css (global, unscoped)
// - Decodes every base64 data:image -> public/images/asset-N.<ext>, rewrites refs
// - Emits src/pages/index.astro (full document) with is:inline on all <script> tags
//   so Astro leaves JSON-LD + the menu IIFE untouched.
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/Luke/Downloads/cleaningjobs-home_3_1.html';
const DEST = 'C:/code/cleaning-jobs';

let html = fs.readFileSync(SRC, 'utf8');

for (const d of ['src', 'src/pages', 'src/styles', 'public', 'public/images']) {
  fs.mkdirSync(path.join(DEST, d), { recursive: true });
}

// 1. Pull out the single <style> block.
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('No <style> block found');
let css = styleMatch[1].trim();
html = html.replace(/\s*<style>[\s\S]*?<\/style>\s*/i, '\n');

// 2. Decode every base64 data:image and rewrite references.
let imgCount = 0;
const written = [];
function extractDataImages(str) {
  return str.replace(
    /data:image\/(jpeg|jpg|png|webp|gif|avif);base64,([A-Za-z0-9+/=\s]+?)(['")])/gi,
    (_m, ext, b64, closer) => {
      const clean = b64.replace(/\s+/g, '');
      imgCount += 1;
      const e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase();
      const fname = `asset-${imgCount}.${e}`;
      const buf = Buffer.from(clean, 'base64');
      fs.writeFileSync(path.join(DEST, 'public/images', fname), buf);
      written.push({ fname, bytes: buf.length });
      return `/images/${fname}${closer}`;
    }
  );
}
css = extractDataImages(css);
html = extractDataImages(html);

// 3. Keep Astro's hands off inline scripts (JSON-LD + menu IIFE + year script).
html = html.replace(/<script(?![^>]*\bis:inline\b)/gi, '<script is:inline');

// 4. Write outputs.
fs.writeFileSync(path.join(DEST, 'src/styles/global.css'), css + '\n', 'utf8');

const page =
  `---\n` +
  `// Homepage — ported verbatim from cleaningjobs-home_3_1.html (pixel-for-pixel).\n` +
  `import '../styles/global.css';\n` +
  `---\n` +
  html.trim() + '\n';
fs.writeFileSync(path.join(DEST, 'src/pages/index.astro'), page, 'utf8');

// 5. Report.
console.log('CSS bytes:', css.length);
console.log('index.astro bytes:', page.length);
console.log('images extracted:', imgCount);
for (const w of written) console.log('  ', w.fname, w.bytes, 'bytes');
const leftover = (page.match(/data:image/gi) || []).length;
console.log('remaining data:image refs in page:', leftover);
console.log('remaining data:image refs in css:', (css.match(/data:image/gi) || []).length);
console.log('script is:inline count:', (page.match(/<script is:inline/gi) || []).length);
