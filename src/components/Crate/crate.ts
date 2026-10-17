/**
 * Crate behaviour (progressive enhancement, no dependencies).
 *
 * - Divider tabs: a real ARIA tablist. ←/→ (wrapping) and Home/End move between
 *   tabs; Enter/Space or a click opens that section. `?crate=<section>` opens a
 *   section on load (and on Back/Forward or a `crate:sync` event), and
 *   switching keeps the URL in sync.
 * - Sleeves: the open section is one tab stop (roving tabindex); ←/→ move between
 *   sleeves (clamped at the ends), Home/End jump to the first/last.
 * - Enter/Space, click or tap "plays" a sleeve: dispatches `record:play`
 *   (see src/lib/events.ts). If no handler calls preventDefault(), full records
 *   open their liner notes and card records are highlighted in the plain list.
 * - Moves and section changes are announced: "DCL-103 Power Smart, 3 of 7",
 *   "Experience: 3 records".
 */
import type { RecordPlayDetail } from '../../lib/events';

const HIGHLIGHT_MS = 2400;

/** Scroll to a card record's entry in the plain list, focus it and flash it. */
function highlightEntry(slug: string): boolean {
  const entry = document.getElementById(`rec-${slug}`);
  if (!entry) return false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  entry.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  entry.focus({ preventScroll: true });
  entry.dataset.highlight = '';
  window.setTimeout(() => delete entry.dataset.highlight, HIGHLIGHT_MS);
  return true;
}

export function initCrate(root: HTMLElement): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-crate-panel]')];
  const dividers = [...root.querySelectorAll<HTMLElement>('[data-divider]')];
  const status = root.querySelector<HTMLElement>('[data-crate-status]');
  if (tabs.length === 0 || panels.length !== tabs.length) return;

  const say = (text: string) => {
    if (status) status.textContent = text;
  };

  // The keyboard hint only tells the truth once this script runs.
  const hint = document.querySelector<HTMLElement>('[data-crate-hint]');
  if (hint) hint.hidden = false;

  // ---------- sleeves: one roving tab stop per section ----------

  const sleevesOf = new Map<HTMLElement, HTMLAnchorElement[]>();
  const activeIn = new Map<HTMLElement, number>();

  for (const panel of panels) {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `crate-tab-${panel.dataset.cratePanel}`);
    if (hint?.id) panel.setAttribute('aria-describedby', hint.id);
    sleevesOf.set(panel, [...panel.querySelectorAll<HTMLAnchorElement>('a[data-slug]')]);
  }

  const setActiveSleeve = (panel: HTMLElement, index: number) => {
    activeIn.set(panel, index);
    sleevesOf.get(panel)?.forEach((sleeve, i) => {
      sleeve.tabIndex = i === index ? 0 : -1;
    });
  };
  panels.forEach((panel) => setActiveSleeve(panel, 0));

  /** The panel and index of the sleeve an event happened on. */
  const locate = (target: EventTarget | null) => {
    const sleeve = (target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-slug]');
    const panel = sleeve?.closest<HTMLElement>('[data-crate-panel]');
    if (!sleeve || !panel) return null;
    const sleeves = sleevesOf.get(panel) ?? [];
    return { panel, sleeves, index: sleeves.indexOf(sleeve) };
  };

  const moveTo = (panel: HTMLElement, index: number) => {
    const sleeves = sleevesOf.get(panel) ?? [];
    const next = Math.max(0, Math.min(sleeves.length - 1, index));
    if (next === activeIn.get(panel) && document.activeElement === sleeves[next]) return;
    setActiveSleeve(panel, next);
    sleeves[next].focus();
    const { catalogue, title } = sleeves[next].dataset;
    say(`${catalogue} ${title}, ${next + 1} of ${sleeves.length}`);
  };

  const play = (sleeve: HTMLAnchorElement) => {
    const { slug = '', catalogue = '', title = '' } = sleeve.dataset;
    const depth = sleeve.dataset.depth === 'card' ? 'card' : 'full';
    const href = sleeve.getAttribute('href') ?? '';
    const detail: RecordPlayDetail = { slug, depth, href, catalogue, title };
    const event = new CustomEvent('record:play', { bubbles: true, cancelable: true, detail });
    if (!sleeve.dispatchEvent(event)) return;
    if (depth === 'card' && highlightEntry(slug)) return;
    if (href) window.location.assign(href);
  };

  // ---------- tabs ----------

  const sectionIds = tabs.map((tab) => tab.dataset.section ?? '');

  const select = (index: number, { user }: { user: boolean }) => {
    const id = sectionIds[index];
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel) => {
      const on = panel.dataset.cratePanel === id;
      panel.hidden = !on;
      panel.toggleAttribute('data-active', on);
      if (!on) panel.removeAttribute('data-flip');
    });
    dividers.forEach((divider) => {
      divider.toggleAttribute('data-active', divider.dataset.divider === id);
      divider.removeAttribute('data-flip');
    });
    if (!user) return;

    // Replay the flip: the board comes forward and the section's sleeves rise.
    const panel = panels[index];
    const divider = dividers.find((d) => d.dataset.divider === id);
    for (const el of [panel, divider]) {
      if (!el) continue;
      void el.offsetWidth;
      el.setAttribute('data-flip', '');
    }

    const { label, count } = tabs[index].dataset;
    say(`${label}: ${count} ${count === '1' ? 'record' : 'records'}`);

    const url = new URL(window.location.href);
    if (index === 0) url.searchParams.delete('crate');
    else url.searchParams.set('crate', id);
    history.replaceState(history.state, '', url);
  };

  const fromUrl = () => {
    const id = new URLSearchParams(window.location.search).get('crate');
    return Math.max(0, sectionIds.indexOf(id ?? ''));
  };
  select(fromUrl(), { user: false });
  // Back/Forward, and Now Playing opening a record in another section.
  const sync = () => {
    const index = fromUrl();
    if (tabs[index].getAttribute('aria-selected') !== 'true') select(index, { user: false });
  };
  window.addEventListener('popstate', sync);
  document.addEventListener('crate:sync', sync);
  root.dataset.enhanced = '';

  const tablist = root.querySelector<HTMLElement>('[data-crate-tabs]');
  tablist?.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    const n = tabs.length;
    const to = {
      ArrowRight: (index + 1) % n,
      ArrowLeft: (index - 1 + n) % n,
      Home: 0,
      End: n - 1,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    tabs[to].focus();
  });

  // Buttons turn Enter/Space into clicks, so this covers keyboard activation too.
  tabs.forEach((tab, i) =>
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') !== 'true') select(i, { user: true });
    }),
  );

  // Moving focus between tabs (manual activation) keeps them all reachable by Tab.
  tablist?.addEventListener('focusin', (event) => {
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index >= 0) tabs.forEach((tab, i) => (tab.tabIndex = i === index ? 0 : -1));
  });
  tablist?.addEventListener('focusout', (event) => {
    if (tablist.contains(event.relatedTarget as Node | null)) return;
    tabs.forEach((tab) => (tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1));
  });

  // ---------- sleeve events, delegated ----------

  // Mouse/touch focus moves the tab stop too, so Tab returns where you were.
  root.addEventListener('focusin', (event) => {
    const hit = locate(event.target);
    if (hit && hit.index >= 0) setActiveSleeve(hit.panel, hit.index);
  });

  root.addEventListener('keydown', (event) => {
    const hit = locate(event.target);
    if (!hit || hit.index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    const { panel, sleeves, index } = hit;
    switch (event.key) {
      case 'ArrowRight':
        moveTo(panel, index + 1);
        break;
      case 'ArrowLeft':
        moveTo(panel, index - 1);
        break;
      case 'Home':
        moveTo(panel, 0);
        break;
      case 'End':
        moveTo(panel, sleeves.length - 1);
        break;
      case 'Enter':
      case ' ':
        play(sleeves[index]);
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  // Plain clicks and taps play; modified clicks keep native link behaviour
  // (open in a new tab/window).
  root.addEventListener('click', (event) => {
    const hit = locate(event.target);
    if (!hit || hit.index < 0 || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    play(hit.sleeves[hit.index]);
  });
}
