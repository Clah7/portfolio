/**
 * `record:play` is dispatched (bubbling, cancelable) from a crate sleeve when a
 * visitor plays a record: click/tap, or Enter/Space on the focused sleeve.
 *
 * Now Playing (src/components/NowPlaying/now-playing.ts) takes it over by
 * calling `event.preventDefault()`. If nothing does (e.g. Now Playing isn't on
 * the page), the crate falls back by depth:
 * - "full": navigate to `detail.href`, the record's liner-notes page;
 * - "card": scroll to and highlight the record's entry in the plain list.
 */
export interface RecordPlayDetail {
  slug: string;
  depth: 'full' | 'card';
  /** Base-aware link: liner notes (full) or the list entry (card). The no-JS fallback. */
  href: string;
  catalogue: string;
  title: string;
}

export type RecordPlayEvent = CustomEvent<RecordPlayDetail>;

declare global {
  interface HTMLElementEventMap {
    'record:play': RecordPlayEvent;
  }
  interface DocumentEventMap {
    'record:play': RecordPlayEvent;
  }
}
