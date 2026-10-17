import { splitPlaceholders } from './placeholder-pattern.mjs';

const escapeHtml = (/** @type {string} */ s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Sätteri mdast plugin (Astro 7's Markdown processor): turns every placeholder
 * in Markdown prose into <mark class="ph">…</mark> so unfinished content is
 * obvious on the page. Code spans and blocks aren't "text" nodes, so they're
 * left alone.
 * @type {import('satteri').MdastPluginEntry}
 */
export const markdownPlaceholders = {
  name: 'crate-digging:placeholders',
  text(node, ctx) {
    const parts = splitPlaceholders(node.value);
    if (!parts.some((p) => p.placeholder)) return;
    ctx.replaceNode(
      node,
      parts.map((p) =>
        p.placeholder
          ? { type: 'html', value: `<mark class="ph">${escapeHtml(p.value)}</mark>` }
          : { type: 'text', value: p.value },
      ),
    );
  },
};
