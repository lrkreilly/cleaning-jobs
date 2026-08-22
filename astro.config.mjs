// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

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
  ],
  build: {
    // Inline CSS into each page's <head> so it isn't a render-blocking request.
    // Total CSS is small (~30 KB) so inlining is a clear LCP/FCP win.
    inlineStylesheets: 'always',
  },
});
