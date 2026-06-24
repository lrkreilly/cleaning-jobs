// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Build timestamp stamped as <lastmod> on every sitemap URL so crawlers can
// prioritise re-fetches. Static site, so all pages share the build date.
const buildDate = new Date();

// https://astro.build/config
export default defineConfig({
  site: 'https://cleaningjobs.co.nz',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = buildDate.toISOString();
        return item;
      },
    }),
  ],
});
