/**
 * Now Playing controller (no dependencies).
 *
 * - Takes over `record:play` (src/lib/events.ts): clones the record's
 *   <template data-np> into the panel (≥ 900px) or the bottom sheet (< 900px).
 * - URL: playing pushes ?record=<slug>&crate=<section>; loading with ?record=
 *   opens it without animation; Back/Forward follow the history. Closing
 *   replaces the entry without ?record=.
 * - The crate sleeve is "pulled": aria-current="true" (styled in Crate.astro).
 * - "Put it back in the crate" / close / Esc / swipe down: close, and focus
 *   returns to the sleeve.
 * - Desktop: the three.js turntable (Turntable/webgl-turntable.ts) takes over
 *   the CSS deck when it can; the CSS deck stays as the fallback.
 * - One Pause control pauses the spin and any video. It also pauses itself
 *   while the panel is off-screen or the tab is hidden. Under reduced motion
 *   it starts paused (nothing spins, no video autoplay).
 */
import { initStage, type StageHandle } from './stage';
import type { RecordInfo } from '../Turntable/webgl-turntable';

type Turntable3d = typeof import('../Turntable/webgl-turntable');

const SWIPE_CLOSE_PX = 120;

/**
 * Resolves on the visitor's first interaction (pointer, wheel, key, touch).
 * A deep link already shows the record spinning on the CSS deck, so three.js
 * (≈135 KB gzipped, plus shader compiles) loads only once someone engages.
 */
const firstInteraction = () =>
  new Promise<void>((resolve) => {
    const events = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'] as const;
    const go = () => {
      for (const e of events) window.removeEventListener(e, go);
      resolve();
    };
    for (const e of events) window.addEventListener(e, go, { passive: true, once: true });
  });

interface Playing {
  slug: string;
  root: HTMLElement;
  container: HTMLElement;
  stage: StageHandle;
}

export function initNowPlaying(): void {
  const panel = document.querySelector<HTMLElement>('[data-np-panel]');
  const sheet = document.querySelector<HTMLDialogElement>('[data-np-sheet]');
  if (!panel || !sheet) return;

  const wide = window.matchMedia('(min-width: 900px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.querySelector<HTMLElement>('[data-crate-status]');

  // The three.js turntable's manager is loaded on demand (desktop only), so the
  // initial bundle doesn't grow; three.js itself is a further lazy chunk.
  let turntable3d: Turntable3d | null = null;
  let loadingTurntable: Promise<Turntable3d | null> | null = null;
  const desktop3d = () => wide.matches && !reduce.matches;
  const loadTurntable = () =>
    (loadingTurntable ??= import('../Turntable/webgl-turntable')
      .then((m) => (turntable3d = m))
      .catch(() => null));

  let playing: Playing | null = null;
  let userPaused = false;
  let offscreen = false;
  let closingSheet = false;

  const template = (slug: string) =>
    document.querySelector<HTMLTemplateElement>(`template[data-np="${CSS.escape(slug)}"]`);
  const sleeveFor = (slug: string) =>
    document.querySelector<HTMLAnchorElement>(`[data-crate] a[data-slug="${CSS.escape(slug)}"]`);

  // ---------- playback state ----------

  const applyPause = () => {
    if (!playing) return;
    const hiddenFromView = playing.container === panel ? offscreen : false;
    const paused = userPaused || hiddenFromView || document.hidden;
    playing.container.toggleAttribute('data-paused', paused);
    turntable3d?.setPaused(paused);
    const button = playing.root.querySelector<HTMLButtonElement>('[data-np-pause]');
    button?.setAttribute('aria-pressed', String(userPaused));
    for (const video of playing.stage.videos) {
      if (paused) video.pause();
      else void video.play().catch(() => {});
    }
  };

  const observer = new IntersectionObserver((entries) => {
    offscreen = entries.every((entry) => !entry.isIntersecting);
    applyPause();
  });
  observer.observe(panel);
  document.addEventListener('visibilitychange', applyPause);

  // ---------- URL ----------

  const urlWith = (slug: string | null, section?: string) => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set('record', slug);
    else url.searchParams.delete('record');
    if (section) url.searchParams.set('crate', section);
    return url;
  };

  // ---------- open / close ----------

  /** The sleeve leaning behind the deck: a decorative copy of the crate's. */
  const fillSleeve = (root: HTMLElement, slug: string) => {
    const slot = root.querySelector<HTMLElement>('[data-np-sleeve]');
    const source = sleeveFor(slug);
    if (!slot || !source) return;
    const copy = source.cloneNode(true) as HTMLElement;
    for (const attr of ['href', 'tabindex', 'aria-current', 'data-slug'])
      copy.removeAttribute(attr);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelector('.visually-hidden')?.remove();
    slot.replaceChildren(copy);
  };

  /** `switching`: another record opens in the same panel, so the 3D deck stays and lifts this one off. */
  const unmount = (switching = false) => {
    if (!playing) return;
    if (playing.container === panel && !switching) turntable3d?.detach();
    sleeveFor(playing.slug)?.removeAttribute('aria-current');
    playing.container.replaceChildren();
    playing = null;
  };

  const open = (
    slug: string,
    { animate = true, push = true }: { animate?: boolean; push?: boolean } = {},
  ): boolean => {
    const tpl = template(slug);
    const content = tpl?.content.firstElementChild;
    if (!tpl || !content) return false;

    const container = wide.matches ? panel : sheet;
    unmount(playing?.container === container && container === panel);
    const root = content.cloneNode(true) as HTMLElement;
    container.replaceChildren(root);
    container.toggleAttribute('data-instant', !animate);
    fillSleeve(root, slug);

    const stage = initStage(root, { autoplay: false });
    playing = { slug, root, container, stage };
    userPaused = reduce.matches;
    // Under reduced motion there's nothing to pause unless there's a video to play.
    const pause = root.querySelector<HTMLElement>('[data-np-pause]');
    if (pause) pause.hidden = reduce.matches && stage.videos.length === 0;
    applyPause();

    const sleeve = sleeveFor(slug);
    sleeve?.setAttribute('aria-current', 'true');
    if (status && sleeve) {
      status.textContent = `Now playing: ${sleeve.dataset.catalogue} ${sleeve.dataset.title}`;
    }

    if (push) {
      history.pushState({ np: slug }, '', urlWith(slug, tpl.dataset.section));
    } else if (new URL(window.location.href).searchParams.get('crate') !== tpl.dataset.section) {
      history.replaceState(history.state, '', urlWith(slug, tpl.dataset.section));
    }
    // The crate opens the record's section (it reads ?crate=).
    document.dispatchEvent(new Event('crate:sync'));

    if (container === panel) {
      const area = root.querySelector<HTMLElement>('.deck-area');
      const d = root.dataset;
      const info: RecordInfo = {
        slug,
        title: d.title ?? '',
        catalogue: d.catalogue ?? '',
        format: d.format === '7in' ? '7in' : '12in',
        ground: d.ground ?? '#1b1714',
        ink: d.ink ?? '#f3ede2',
        accents: d.accents ? d.accents.split(',') : [],
      };
      if (area && turntable3d) {
        turntable3d.attach(area, info, { animate, sleeve: animate ? sleeveFor(slug) : null });
      } else if (area && desktop3d()) {
        // Not loaded yet: the CSS deck plays now; the 3D one cross-fades in when ready.
        // A deep link waits for the first interaction (see firstInteraction).
        void (animate ? Promise.resolve() : firstInteraction()).then(loadTurntable).then((m) => {
          if (m && playing?.root === root) m.attach(area, info, { animate: false, sleeve: null });
        });
      }
    }

    const title = root.querySelector<HTMLElement>('#np-title');
    if (container === panel) {
      panel.hidden = false;
      panel.scrollIntoView({
        behavior: animate && !reduce.matches ? 'smooth' : 'auto',
        block: 'start',
      });
      title?.focus({ preventScroll: true });
    } else {
      sheet.style.transform = '';
      if (!sheet.open) sheet.showModal();
      title?.focus();
    }
    return true;
  };

  const close = ({ fromHistory = false }: { fromHistory?: boolean } = {}) => {
    if (!playing) return;
    const { slug, container } = playing;
    unmount();
    if (container === panel) {
      panel.hidden = true;
      panel.style.minHeight = '';
    }
    if (sheet.open) {
      closingSheet = true;
      sheet.close();
      closingSheet = false;
    }
    if (!fromHistory) history.replaceState(null, '', urlWith(null));
    sleeveFor(slug)?.focus({ preventScroll: container === sheet });
  };

  // ---------- events ----------

  document.addEventListener('record:play', (event) => {
    event.preventDefault();
    const { slug } = event.detail;
    if (playing?.slug === slug) {
      playing.root.querySelector<HTMLElement>('#np-title')?.focus();
      return;
    }
    open(slug);
  });

  for (const container of [panel, sheet]) {
    container.addEventListener('click', (event) => {
      const target = event.target as Element;
      if (target.closest('[data-np-close]')) close();
      else if (target.closest('[data-np-pause]')) {
        userPaused = !userPaused;
        applyPause();
      }
    });
  }

  // Esc (native) closes the dialog; keep our state and the URL in step.
  sheet.addEventListener('close', () => {
    if (!closingSheet && playing?.container === sheet) close();
  });

  window.addEventListener('popstate', () => {
    const slug = new URL(window.location.href).searchParams.get('record');
    if (slug && template(slug)) {
      if (playing?.slug !== slug) open(slug, { push: false });
    } else {
      close({ fromHistory: true });
    }
  });

  // Crossing the breakpoint moves the record into the other container.
  wide.addEventListener('change', () => {
    if (!playing) return;
    const { slug } = playing;
    if (sheet.open) {
      closingSheet = true;
      sheet.close();
      closingSheet = false;
    }
    panel.hidden = true;
    open(slug, { animate: false, push: false });
  });

  // ---------- swipe the sheet down to close ----------

  let startY: number | null = null;
  let dragY = 0;
  sheet.addEventListener('pointerdown', (event) => {
    const handle = (event.target as Element).closest('[data-np-grab], .head');
    if (!handle || (event.target as Element).closest('button, a')) return;
    if (sheet.scrollTop > 0) return;
    startY = event.clientY;
    dragY = 0;
    sheet.setPointerCapture(event.pointerId);
    sheet.setAttribute('data-dragging', '');
    sheet.removeAttribute('data-settling');
  });
  sheet.addEventListener('pointermove', (event) => {
    if (startY === null) return;
    dragY = Math.max(0, event.clientY - startY);
    sheet.style.transform = `translateY(${dragY}px)`;
  });
  const endDrag = () => {
    if (startY === null) return;
    startY = null;
    sheet.removeAttribute('data-dragging');
    if (dragY > SWIPE_CLOSE_PX) {
      sheet.style.transform = '';
      close();
    } else {
      sheet.setAttribute('data-settling', '');
      sheet.style.transform = '';
    }
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);

  // Fetch and build the three.js deck while the visitor browses the crate.
  const crate = document.querySelector('[data-crate]');
  const prefetch = () => {
    if (desktop3d()) void loadTurntable().then((m) => m?.prefetch());
  };
  crate?.addEventListener('pointerenter', prefetch, { once: true });
  crate?.addEventListener('focusin', prefetch, { once: true });

  // ---------- deep link ----------

  const initial = new URL(window.location.href).searchParams.get('record');
  if (!initial || !open(initial, { animate: false, push: false })) {
    // NowPlaying.astro may have opened the panel's space for a deep link; release it.
    panel.hidden = true;
    panel.style.minHeight = '';
  }
}
