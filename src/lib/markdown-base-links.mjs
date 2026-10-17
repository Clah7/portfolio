/**
 * Sätteri mdast plugin: prefixes site-internal Markdown links ("/records/baur/")
 * with the configured base, so they work under a GitHub Pages sub-path like
 * /portfolio/. Full URLs, protocol-relative URLs and fragments are left alone.
 * @param {string} base e.g. "/portfolio" or "/"
 * @returns {import('satteri').MdastPluginEntry}
 */
export function markdownBaseLinks(base) {
  const prefix = base.replace(/\/+$/, '');
  return {
    name: 'crate-digging:base-links',
    link(node, ctx) {
      if (!prefix || !node.url.startsWith('/') || node.url.startsWith('//')) return;
      if (node.url === prefix || node.url.startsWith(`${prefix}/`)) return;
      ctx.setProperty(node, 'url', `${prefix}${node.url}`);
    },
  };
}
