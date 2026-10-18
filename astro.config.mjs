// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { markdownBaseLinks } from './src/lib/markdown-base-links.mjs';
import { markdownPlaceholders } from './src/lib/markdown-placeholders.mjs';

/*
 * GitHub Pages serves a user site (<owner>.github.io) from "/" and any other
 * repo from "/<repo>". GITHUB_REPOSITORY is set inside GitHub Actions; locally
 * we fall back to this repo so dev/preview mirror production.
 * BASE_PATH and SITE_URL override both (e.g. for a custom domain: BASE_PATH=/).
 */
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? 'Clah7/portfolio').split('/');
const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;

const site = process.env.SITE_URL ?? `https://${owner.toLowerCase()}.github.io`;
const base = process.env.BASE_PATH ?? (isUserSite ? '/' : `/${repo}`);

// Production builds leave lone placeholders out (src/lib/visible.ts); `astro dev` shows them.
const isBuild = process.argv.includes('build');

// The condensed portfolio PDF (`npm run pdf`): its print page is only built then,
// so the deployed site never has it.
/** @type {import('astro').AstroIntegration} */
const portfolioPdf = {
  name: 'portfolio-pdf',
  hooks: {
    'astro:config:setup': ({ injectRoute }) =>
      injectRoute({ pattern: '/pdf/portfolio', entrypoint: './src/pdf/Portfolio.astro' }),
  },
};

export default defineConfig({
  site,
  base,
  output: 'static',
  // Inline the (small) stylesheets: no render-blocking CSS requests before first paint.
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'ignore',
  integrations: [
    // Link-preview templates (/og/*), the Now Playing fragment and the 404 page
    // aren't for search engines.
    sitemap({
      filter: (page) =>
        !page.includes('/og/') &&
        !page.includes('/now-playing/') &&
        !page.includes('/pdf/') &&
        !/\/404\/?$/.test(page),
    }),
    ...(process.env.PORTFOLIO_PDF ? [portfolioPdf] : []),
  ],
  markdown: {
    // Sätteri is Astro 7's default Markdown processor; this only adds our plugins.
    processor: satteri({
      mdastPlugins: [markdownPlaceholders({ hideWhole: isBuild }), markdownBaseLinks(base)],
    }),
  },
});
