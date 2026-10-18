import { isPlaceholder } from './placeholder-pattern.mjs';

/**
 * Production builds leave out anything that is *only* a placeholder: a list item,
 * a field, a row (and a section whose items all go). Text that merely contains
 * one still shows the chip, and `npm run check` flags it as visible on the live
 * site. In `astro dev` everything shows, so gaps stay easy to find.
 */
const HIDE = import.meta.env.PROD;

/** Whether a value should render: present, and not a lone placeholder in production. */
export function shown(text: string | null | undefined): text is string {
  return Boolean(text) && !(HIDE && isPlaceholder(text));
}

/** The items to render: drops items whose text (or every picked text) is a lone placeholder. */
export function visible<T>(
  items: readonly T[] | undefined,
  pick?: (item: T) => (string | undefined)[],
): T[] {
  return (items ?? []).filter((item) => {
    const texts = pick ? pick(item) : [item as unknown as string];
    return texts.some((t) => shown(t));
  });
}
