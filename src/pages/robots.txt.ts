import type { APIRoute } from 'astro';
import { url } from '../lib/url';

/** robots.txt: everything may be crawled; the sitemap's URL includes the base path. */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(url('sitemap-index.xml'), site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
