/**
 * WebGL turntable manager (in the initial bundle, so it stays tiny and never
 * imports three.js statically: the scene is loaded with a dynamic import()).
 *
 * The three.js deck replaces the CSS turntable in the desktop Now Playing panel
 * only when all of these hold: viewport ≥ 900px, no prefers-reduced-motion, no
 * Save-Data, and a WebGL2 context can be created. Otherwise (and on any failure:
 * the import, the context, a shader, a lost context) the CSS turntable stays,
 * with one console.warn and no visible error. The CSS turntable is the fallback;
 * never remove it.
 *
 * - prefetch(): load the chunk while idle, on the first hover/focus of the crate.
 * - attach(): mount the (single, reused) canvas over a record's CSS deck. If the
 *   chunk is ready, the sleeve flies to the deck (FLIP, Web Animations) and the
 *   record drops, cues and spins up; if not, the CSS deck shows first and the
 *   3D one cross-fades in, already playing.
 * - detach(): reset when the panel closes; labels are freed after a while and
 *   everything is disposed of on pagehide.
 */
import type { RecordInfo, TurntableHandle } from './three/index';

export type { RecordInfo };

let modulePromise: Promise<typeof import('./three/index')> | null = null;
const load = () => (modulePromise ??= import('./three/index'));

let handle: TurntableHandle | null = null;
let creating: Promise<TurntableHandle | null> | null = null;
let host: HTMLDivElement | null = null;
let deckArea: HTMLElement | null = null;
let current: RecordInfo | null = null;
let paused = false;
let disabled = false;
let webgl2: boolean | null = null;
let releaseTimer = 0;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2 = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

export function eligible(): boolean {
  if (disabled) return false;
  if (!window.matchMedia('(min-width: 900px)').matches) return false;
  if (reduceMotion()) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  return hasWebGL2();
}

const idle = (fn: () => void) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200);
/** Yield to the browser between the heavy steps, so none of them becomes one long task. */
const nextIdle = () => new Promise<void>((resolve) => idle(() => resolve()));

let prefetched = false;
/** Load the chunk and build the scene (shaders compiled) while idle, before the first play. */
export function prefetch(): void {
  if (prefetched) return;
  prefetched = true;
  idle(() => {
    if (eligible()) void ensure();
  });
}

function getHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement('div');
    host.className = 'tt3d';
    host.setAttribute('aria-hidden', 'true');
  }
  return host;
}

function fallback(reason: string): void {
  if (disabled) return;
  disabled = true;
  document.documentElement.dataset.turntable = 'css';
  console.warn(`[turntable] WebGL turntable unavailable (${reason}); using the CSS turntable.`);
  deckArea?.removeAttribute('data-tt3d');
  host?.remove();
  try {
    handle?.dispose();
  } catch {
    // Already broken; nothing more to free.
  }
  handle = null;
  host = null;
}

async function ensure(): Promise<TurntableHandle | null> {
  if (handle) return handle;
  creating ??= (async () => {
    try {
      const mod = await load();
      await nextIdle();
      if (disabled) return null;
      const created = mod.createTurntable(getHost(), fallback);
      await nextIdle();
      await created.warm();
      handle = created;
      // A marker for tests and debugging: the 3D deck is built and its shaders compiled.
      document.documentElement.dataset.turntable = '3d';
      return handle;
    } catch (error) {
      fallback(error instanceof Error ? error.message : String(error));
      return null;
    }
  })();
  return creating;
}

/** Resolve once the page has stopped scrolling (the panel scrolls into view smoothly). */
function scrollSettled(): Promise<void> {
  return new Promise((resolve) => {
    let last = window.scrollY;
    let still = 0;
    const started = performance.now();
    const check = () => {
      still = window.scrollY === last ? still + 1 : 0;
      last = window.scrollY;
      if (still >= 3 || performance.now() - started > 1200) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

/** FLIP: a copy of the crate sleeve flies to where the record will appear, then fades. */
async function flySleeve(sleeve: HTMLElement, h: TurntableHandle): Promise<void> {
  await scrollSettled();
  const from = sleeve.getBoundingClientRect();
  const to = h.dropTarget();
  if (from.width === 0 || !to.size) return;
  const clone = sleeve.cloneNode(true) as HTMLElement;
  for (const attr of ['href', 'tabindex', 'aria-current', 'data-slug', 'id'])
    clone.removeAttribute(attr);
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    zIndex: '60',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    transform: 'none',
  });
  document.body.append(clone);
  const scale = to.size / from.width;
  const dx = to.x - to.size / 2 - from.left;
  const dy = to.y - to.size / 2 - from.top;
  const end = `translate(${dx}px, ${dy}px) scale(${scale})`;
  const flight = clone.animate(
    [
      { transform: 'none', opacity: 1 },
      { transform: end, opacity: 1, offset: 0.75 },
      { transform: end, opacity: 0 },
    ],
    { duration: 450, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
  );
  try {
    await flight.finished;
  } finally {
    clone.remove();
  }
}

export function attach(
  area: HTMLElement,
  info: RecordInfo,
  { animate, sleeve }: { animate: boolean; sleeve: HTMLElement | null },
): void {
  if (!eligible()) return;
  window.clearTimeout(releaseTimer);
  current = info;
  deckArea = area;
  area.append(getHost());
  const wasReady = Boolean(handle);
  area.setAttribute('data-tt3d', wasReady ? 'on' : 'loading');

  void ensure().then(async (h) => {
    if (!h || current !== info || deckArea !== area) return;
    area.setAttribute('data-tt3d', 'on');
    h.pause(paused);
    try {
      if (wasReady && animate && sleeve) {
        await h.play(info, { instant: false, arrival: flySleeve(sleeve, h) });
      } else {
        // Deep link, or the chunk arrived after the CSS deck had started: cross-fade in, already playing.
        await h.play(info, { instant: true });
      }
    } catch (error) {
      fallback(error instanceof Error ? error.message : String(error));
    }
  });
}

export function setPaused(value: boolean): void {
  paused = value;
  handle?.pause(value);
}

/** The panel closed (or moved to the mobile sheet): put the record away. */
export function detach(): void {
  current = null;
  deckArea?.removeAttribute('data-tt3d');
  deckArea = null;
  host?.remove();
  void handle?.stop({ instant: true });
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => handle?.release(), 15000);
}

window.addEventListener('pagehide', () => {
  handle?.dispose();
  handle = null;
  creating = null;
});
