// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SITE = 'https://cleaningjobs.co.nz';

// Auto-generate /llms-full.txt from the rendered pages on every build (ported from the
// Spruce hook), so AI answer engines always have the current full site text. The curated
// index lives at public/llms.txt.
function llmsFull() {
  const EXCLUDE = ['404/'];
  const clean = (html) => {
    const m = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
    let s = m ? m[1] : html;
    return s
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|h[1-6]|li|section|article|figcaption|blockquote|tr|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&#39;|&rsquo;|&apos;/gi, "'").replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
      .replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–').replace(/&hellip;/gi, '…')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };
  return {
    name: 'cleaning-jobs-llms-full',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const outDir = fileURLToPath(dir);
        const list = pages
          .map((p) => p.pathname)
          .filter((pn) => !EXCLUDE.some((e) => pn === e || pn.startsWith(e)))
          .sort((a, b) => a.localeCompare(b));
        let out =
          '# Cleaning Jobs — full site content for LLMs\n' +
          '> Auto-generated from the live pages on each build. Cleaning Jobs (cleaningjobs.co.nz) is the recruitment and onboarding arm of The Spruce Company, a New Zealand cleaning company. Cleaners apply once; suitable applicants complete onboarding and training to the Spruce standard and become eligible for residential and commercial work allocation. Work is not guaranteed; allocation depends on demand, suitability, availability, and certification.\n' +
          '> Index: https://cleaningjobs.co.nz/llms.txt\n\n';
        let n = 0;
        for (const pn of list) {
          let html;
          try { html = await readFile(join(outDir, pn, 'index.html'), 'utf-8'); }
          catch { continue; }
          const title = ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || pn)
            .replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"').trim();
          const text = clean(html);
          if (!text) continue;
          out += `## ${title}\nURL: ${SITE}/${pn}\n\n${text}\n\n---\n\n`;
          n++;
        }
        await writeFile(join(outDir, 'llms-full.txt'), out, 'utf-8');
        logger.info(`llms-full.txt generated (${n} pages)`);
      },
    },
  };
}

// Strip developer HTML comments (<!-- ... -->) from the built pages on every build. They
// never render but otherwise ship in the page source. Inline <script>/<style> and JSON-LD
// blocks contain no <!-- markers, so a global strip over the .html output is safe.
function stripHtmlComments() {
  const walk = async (d) => {
    const out = [];
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) out.push(...(await walk(p)));
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  };
  return {
    name: 'cleaning-jobs-strip-html-comments',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const files = await walk(fileURLToPath(dir));
        let pages = 0, bytes = 0;
        for (const f of files) {
          const html = await readFile(f, 'utf-8');
          const out = html.replace(/<!--[\s\S]*?-->/g, '');
          if (out.length !== html.length) { bytes += html.length - out.length; await writeFile(f, out, 'utf-8'); pages++; }
        }
        logger.info(`stripped HTML comments from ${pages} pages (${bytes} bytes)`);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://cleaningjobs.co.nz',
  trailingSlash: 'ignore',
  integrations: [
    // No lastmod: stamping the build date on every URL every deploy carries no
    // per-page signal. Reinstate only if it can reflect actual page changes.
    sitemap(),
    stripHtmlComments(),
    llmsFull(),
  ],
  build: {
    // Inline CSS into each page's <head> so it isn't a render-blocking request.
    // Total CSS is small (~30 KB) so inlining is a clear LCP/FCP win.
    inlineStylesheets: 'always',
  },
});
