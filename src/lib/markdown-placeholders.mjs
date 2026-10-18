import { isPlaceholder, splitPlaceholders } from './placeholder-pattern.mjs';

const escapeHtml = (/** @type {string} */ s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text of an mdast node. */
const textOf = (/** @type {any} */ node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join('');

/**
 * Sätteri mdast plugin (Astro 7's Markdown processor): turns every placeholder
 * in Markdown prose into <mark class="ph">…</mark> so unfinished content is
 * obvious on the page. Code spans and blocks aren't "text" nodes, so they're
 * left alone.
 *
 * With `hideWhole` (production builds), a paragraph that is *only* a
 * placeholder is removed instead; a sentence that merely contains one keeps the
 * chip (and `npm run check` reports it as visible on the live site).
 * @param {{ hideWhole?: boolean }} [options]
 * @returns {import('satteri').MdastPluginEntry}
 */
export function markdownPlaceholders({ hideWhole = false } = {}) {
  return {
    name: 'crate-digging:placeholders',
    paragraph(node, ctx) {
      if (hideWhole && isPlaceholder(textOf(node))) ctx.removeNode(node);
    },
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
}
