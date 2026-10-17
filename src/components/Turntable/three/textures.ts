/**
 * Canvas-drawn textures: record grooves (colour + roughness), the record
 * label (cover colours, title in Big Shoulders) and the speed decal on the plinth.
 * No images are loaded and no brand marks are drawn.
 */
import { CanvasTexture, LinearSRGBColorSpace, SRGBColorSpace } from 'three';

export interface RecordInfo {
  slug: string;
  title: string;
  catalogue: string;
  format: '12in' | '7in';
  ground: string;
  ink: string;
  accents: string[];
}

const canvas = (w: number, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Concentric grooves for the record's top face. `labelFraction` is the label's
 * radius as a share of the record's; the grooves stop short of it (the run-out).
 */
export function grooveTextures(labelFraction: number) {
  const size = 1024;
  const half = size / 2;
  const colour = canvas(size);
  const rough = canvas(size);
  const c = colour.getContext('2d')!;
  const r = rough.getContext('2d')!;

  c.fillStyle = '#141210';
  c.fillRect(0, 0, size, size);
  r.fillStyle = 'rgb(150,150,150)';
  r.fillRect(0, 0, size, size);

  const inner = half * labelFraction * 1.12;
  const outer = half * 0.985;
  // Grooves in bands, with a few wider gaps between "tracks".
  const gaps = [0.28, 0.47, 0.66, 0.83].map((f) => inner + (outer - inner) * f);
  for (let radius = inner; radius < outer; radius += 1.6) {
    const gap = gaps.some((g) => Math.abs(radius - g) < 1.2);
    const odd = Math.round(radius / 1.6) % 2 === 0;
    c.strokeStyle = gap ? '#0f0e0d' : odd ? '#191714' : '#131210';
    r.strokeStyle = gap ? 'rgb(200,200,200)' : odd ? 'rgb(80,80,80)' : 'rgb(115,115,115)';
    c.lineWidth = r.lineWidth = 1;
    for (const [ctx] of [[c], [r]] as const) {
      ctx.beginPath();
      ctx.arc(half, half, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Smooth lead-in and run-out rings.
  for (const [ctx, style] of [
    [c, '#181614'],
    [r, 'rgb(60,60,60)'],
  ] as const) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = style;
    ctx.beginPath();
    ctx.arc(half, half, outer + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  const map = new CanvasTexture(colour);
  map.colorSpace = SRGBColorSpace;
  const roughnessMap = new CanvasTexture(rough);
  roughnessMap.colorSpace = LinearSRGBColorSpace;
  for (const t of [map, roughnessMap]) t.anisotropy = 4;
  return { map, roughnessMap };
}

/** Split a title over at most two balanced lines. */
function lines(title: string): string[] {
  const words = title.toUpperCase().split(/\s+/);
  if (words.length < 2 || title.length <= 9) return [words.join(' ')];
  let best = [words.join(' ')];
  let bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const len = Math.max(a.length, b.length);
    if (len < bestLen) {
      bestLen = len;
      best = [a, b];
    }
  }
  return best;
}

/** Wait for the label fonts so the title is drawn in Big Shoulders, not a fallback. */
export async function labelFontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('900 64px "Big Shoulders"'),
      document.fonts.load('700 20px "Schibsted Grotesk"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Draw with whatever is available.
  }
}

/** The record label: cover colours, an accent shape echoing the sleeve, title and catalogue. */
export function labelTexture(info: RecordInfo): CanvasTexture {
  const size = 512;
  const half = size / 2;
  const el = canvas(size);
  const ctx = el.getContext('2d')!;
  const a1 = info.accents[0] ?? info.ink;
  const a2 = info.accents[1] ?? a1;

  ctx.save();
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = info.ground;
  ctx.fillRect(0, 0, size, size);

  // Accent shapes: a large disc off to the lower right, as on the CSS label and sleeves.
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = a1;
  ctx.beginPath();
  ctx.arc(half * 1.45, half * 1.45, half * 0.62, 0, Math.PI * 2);
  ctx.fill();
  if (a2 !== a1) {
    ctx.fillStyle = a2;
    ctx.beginPath();
    ctx.arc(half * 1.45, half * 1.45, half * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Title, fitted to the label's width.
  const rows = lines(info.title);
  const maxWidth = size * 0.72;
  let fontSize = 150;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = (px: number) => `900 ${px}px "Big Shoulders", "Avenir Next Condensed", sans-serif`;
  ctx.font = font(fontSize);
  while (fontSize > 28 && Math.max(...rows.map((l) => ctx.measureText(l).width)) > maxWidth) {
    fontSize -= 4;
    ctx.font = font(fontSize);
  }
  ctx.fillStyle = info.ink;
  const lineHeight = fontSize * 0.92;
  const top = half - ((rows.length - 1) * lineHeight) / 2 - fontSize * 0.18;
  rows.forEach((row, i) => ctx.fillText(row, half, top + i * lineHeight));

  // Catalogue line
  const side = info.format === '7in' ? '45 RPM' : 'SIDE A';
  ctx.font = '700 22px "Schibsted Grotesk", "Helvetica Neue", sans-serif';
  if ('letterSpacing' in ctx)
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '3px';
  ctx.fillText(`${info.catalogue} · ${side}`, half, size * 0.8);

  // Spindle hole
  ctx.fillStyle = '#0b0a09';
  ctx.beginPath();
  ctx.arc(half, half, size * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** "33⅓ · 45" with a dot showing the selected speed, printed on the plinth. */
export function speedDecal(): { texture: CanvasTexture; set: (format: '12in' | '7in') => void } {
  const el = canvas(512, 128);
  const ctx = el.getContext('2d')!;
  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  const set = (format: '12in' | '7in') => {
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.font = '700 52px "Schibsted Grotesk", "Helvetica Neue", sans-serif';
    ctx.textBaseline = 'middle';
    const items: [string, boolean][] = [
      ['33⅓', format === '12in'],
      ['45', format === '7in'],
    ];
    let x = 40;
    for (const [text, on] of items) {
      ctx.fillStyle = on ? '#c2603a' : '#5c564f';
      ctx.beginPath();
      ctx.arc(x, 64, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9c3ba';
      ctx.fillText(text, x + 24, 66);
      x += 240;
    }
    texture.needsUpdate = true;
  };
  set('12in');
  return { texture, set };
}
