import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// From the project root: at build time this runs from a bundled chunk.
const publicDir = join(process.cwd(), 'public');

/**
 * Intrinsic size of a WebP under public/ (e.g. "records/power-smart/screens.webp"), read
 * from its header at build time so <img> gets width/height and doesn't shift the
 * layout. Returns undefined for other formats or missing files.
 */
export function webpSize(src: string): { width: number; height: number } | undefined {
  if (!src.endsWith('.webp') || /^https?:\/\//.test(src)) return undefined;
  let buf: Buffer;
  try {
    buf = readFileSync(join(publicDir, src.replace(/^\/+/, '')));
  } catch {
    return undefined;
  }
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  switch (buf.toString('ascii', 12, 16)) {
    case 'VP8 ':
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    case 'VP8L': {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    case 'VP8X':
      return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    default:
      return undefined;
  }
}
