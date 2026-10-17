/**
 * Stage behaviour (no dependencies). initStage() wires one [data-stage]:
 * gallery Prev/Next + counter, the YouTube facade (no request to YouTube until
 * it's pressed), the certificate lightbox, and video playback.
 */

export interface StageHandle {
  /** Videos on this stage; the Now Playing Pause control drives them. */
  videos: HTMLVideoElement[];
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initGallery(gallery: HTMLElement) {
  const track = gallery.querySelector<HTMLElement>('[data-gallery-track]');
  const prev = gallery.querySelector<HTMLButtonElement>('[data-gallery-prev]');
  const next = gallery.querySelector<HTMLButtonElement>('[data-gallery-next]');
  const counter = gallery.querySelector<HTMLElement>('[data-gallery-counter]');
  const caption = gallery.querySelector<HTMLElement>('[data-gallery-caption]');
  const captions = [...gallery.querySelectorAll<HTMLElement>('[data-gallery-caption-text]')].map(
    (el) => el.textContent?.trim() ?? '',
  );
  if (!track) return;
  const count = track.children.length;
  let index = 0;

  const show = (i: number) => {
    index = i;
    if (counter) counter.textContent = `${i + 1} of ${count}`;
    if (caption) caption.textContent = captions[i] ?? '';
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === count - 1;
  };

  const go = (i: number) => {
    const to = Math.max(0, Math.min(count - 1, i));
    track.scrollTo({
      left: to * track.clientWidth,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
    show(to);
  };

  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));

  // Swipes and keyboard scrolling move the counter too.
  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== index) show(Math.max(0, Math.min(count - 1, i)));
    });
  });
}

function initYouTube(box: HTMLElement) {
  const button = box.querySelector<HTMLButtonElement>('[data-yt-play]');
  const id = box.dataset.yt;
  if (!button || !id) return;
  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    iframe.title = box.dataset.ytTitle ?? 'Video';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    button.replaceWith(iframe);
    iframe.focus();
  });
}

function initLightbox(root: HTMLElement) {
  const open = root.querySelector<HTMLButtonElement>('[data-lightbox-open]');
  const dialog = root.querySelector<HTMLDialogElement>('[data-lightbox]');
  const close = root.querySelector<HTMLButtonElement>('[data-lightbox-close]');
  if (!open || !dialog) return;
  open.addEventListener('click', () => dialog.showModal());
  close?.addEventListener('click', () => dialog.close());
  // A click on the backdrop (the dialog itself, outside the image) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => open.focus());
}

function initVideoToggle(root: HTMLElement, videos: HTMLVideoElement[]) {
  const toggle = root.querySelector<HTMLButtonElement>('[data-stage-video-toggle]');
  if (!toggle || videos.length === 0) return;
  const sync = () => {
    const paused = videos.every((v) => v.paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Play demo' : 'Pause demo';
  };
  toggle.addEventListener('click', () => {
    const paused = videos.every((v) => v.paused);
    videos.forEach((v) => (paused ? void v.play().catch(() => {}) : v.pause()));
  });
  videos.forEach((v) => {
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
  });
  sync();
}

export function initStage(root: HTMLElement, { autoplay }: { autoplay: boolean }): StageHandle {
  const stage = root.matches('[data-stage]')
    ? root
    : root.querySelector<HTMLElement>('[data-stage]');
  if (!stage) return { videos: [] };

  stage.querySelectorAll<HTMLElement>('[data-gallery]').forEach(initGallery);
  stage.querySelectorAll<HTMLElement>('[data-yt]').forEach(initYouTube);
  stage.querySelectorAll<HTMLElement>('[data-lightbox-root]').forEach(initLightbox);

  const videos = [...stage.querySelectorAll<HTMLVideoElement>('[data-stage-video]')];
  initVideoToggle(stage, videos);
  if (autoplay && !reducedMotion()) videos.forEach((v) => void v.play().catch(() => {}));
  return { videos };
}
