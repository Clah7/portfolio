// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
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

export default defineConfig({
  site,
  base,
  output: 'static',
  // Inline the (small) stylesheets: no render-blocking CSS requests before first paint.
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'ignore',
  markdown: {
    // Sätteri is Astro 7's default Markdown processor; this only adds our plugins.
    processor: satteri({ mdastPlugins: [markdownPlaceholders, markdownBaseLinks(base)] }),
  },
});
