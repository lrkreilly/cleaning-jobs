// Assembles src/pages/legal/index.astro from the about-page shell (identical
// head/header/footer) with privacy-policy content swapped into <main>.
// Placeholders from the source draft are resolved truthfully; see comments.
import fs from 'node:fs';
import path from 'node:path';

const DEST = 'C:/code/cleaning-jobs';
let shell = fs.readFileSync(path.join(DEST, 'src/pages/about/index.astro'), 'utf8');

// 1. Swap the CSS import.
shell = shell.replace("import '../../styles/about.css';", "import '../../styles/legal.css';");
shell = shell.replace('// about — ported from about.html (pixel-for-pixel).',
  '// legal — privacy policy. Content from Downloads/privacy-policy.md, drafting\n// note removed and [CONFIRM] placeholders resolved to known-true facts.');

// 2. Head metadata.
shell = shell.replace('<title>About | Cleaning Jobs NZ</title>', '<title>Privacy Policy | Cleaning Jobs NZ</title>');
shell = shell.replace(/<link rel="canonical" href="https:\/\/cleaningjobs\.co\.nz\/about\/" \/>/,
  '<link rel="canonical" href="https://cleaningjobs.co.nz/legal/" />');
const DESC = 'How Cleaning Jobs collects, uses, shares, and protects your personal information under the New Zealand Privacy Act 2020.';
shell = shell.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${DESC}" />`);
shell = shell.replace(/<meta property="og:title" content="[^"]*" \/>/, '<meta property="og:title" content="Privacy Policy | Cleaning Jobs NZ" />');
shell = shell.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${DESC}" />`);
shell = shell.replace(/<meta property="og:url" content="https:\/\/cleaningjobs\.co\.nz\/about\/" \/>/, '<meta property="og:url" content="https://cleaningjobs.co.nz/legal/" />');
shell = shell.replace(/<meta name="twitter:title" content="[^"]*" \/>/, '<meta name="twitter:title" content="Privacy Policy | Cleaning Jobs NZ" />');
shell = shell.replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${DESC}" />`);

// 3. Replace the two JSON-LD blocks (AboutPage/Organization) with a single noindex-friendly one.
//    Keep it minimal and accurate.
shell = shell.replace(/<script is:inline type="application\/ld\+json">[\s\S]*?<\/script>\s*<script is:inline type="application\/ld\+json">[\s\S]*?<\/script>/,
`<script is:inline type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "PrivacyPolicy",
    "name": "Privacy Policy",
    "url": "https://cleaningjobs.co.nz/legal/",
    "inLanguage": "en-NZ",
    "publisher": { "@type": "Organization", "name": "Cleaning Jobs", "url": "https://cleaningjobs.co.nz/" }
  }
  </script>`);

// 4. Mark no nav item current except keep them all linkable (legal isn't in primary nav).
shell = shell.replace(/ aria-current="page"/g, '');

// 5. Swap <main>…</main>.
const main = fs.readFileSync(path.join(DEST, 'scripts/legal-main.html'), 'utf8').trim();
shell = shell.replace(/<main id="main">[\s\S]*?<\/main>/, main);

fs.mkdirSync(path.join(DEST, 'src/pages/legal'), { recursive: true });
fs.writeFileSync(path.join(DEST, 'src/pages/legal/index.astro'), shell, 'utf8');
console.log('wrote src/pages/legal/index.astro  bytes:', shell.length);
console.log('CONFIRM left:', (shell.match(/\[CONFIRM/g) || []).length);
console.log('has #privacy anchor:', /id="privacy"/.test(shell));
console.log('has #terms anchor:', /id="terms"/.test(shell));
