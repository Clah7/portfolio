/**
 * The one definition of a content placeholder, shared by the site (remark
 * plugin + <Ph>) and scripts/check-placeholders.mjs.
 *
 * A placeholder is square brackets around an ALL-CAPS lead of 2+ characters,
 * optionally followed by " — free text":
 *   ROLE, RESUME PDF LINK, APP DEMO VIDEO — Baur   (each wrapped in [ ])
 * A bracket directly followed by "(" is a Markdown link and never matches.
 */
export const PLACEHOLDER_SOURCE =
  "\\[[A-Z][A-Z0-9 '’&/,.+→-]*[A-Z0-9](?:\\s+[—–-]\\s+[^\\[\\]\\n]+)?\\](?!\\()";

/** A fresh global RegExp (global regexes carry lastIndex state, so never share one). */
export function placeholderRegex() {
  return new RegExp(PLACEHOLDER_SOURCE, 'g');
}

/**
 * Split text into plain and placeholder parts, in order.
 * @param {string} text
 * @returns {{ value: string, placeholder: boolean }[]}
 */
export function splitPlaceholders(text) {
  /** @type {{ value: string, placeholder: boolean }[]} */
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(placeholderRegex())) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ value: text.slice(last, start), placeholder: false });
    parts.push({ value: match[0], placeholder: true });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ value: text.slice(last), placeholder: false });
  return parts;
}

/**
 * True when the whole (trimmed) string is a single placeholder, e.g. a resume
 * URL that hasn't been filled in yet. Use it before putting a value in an attribute.
 * @param {string | undefined | null} value
 */
export function isPlaceholder(value) {
  if (!value) return false;
  const parts = splitPlaceholders(value.trim());
  return parts.length === 1 && parts[0].placeholder;
}
