import { statSync } from 'node:fs';
import { join } from 'node:path';
import { url } from './url';

// Resolved from the project root: at build time this module runs from a bundled
// chunk, so a path relative to import.meta.url wouldn't point at public/.
const file = join(process.cwd(), 'public', 'resume.pdf');

/**
 * The resume, if public/resume.pdf exists at build time: its link and size
 * ("177 KB"). Without the file, every resume button is left out and
 * `npm run check` reports "resume.pdf missing".
 */
export function resume(): { href: string; size: string } | null {
  try {
    const { size } = statSync(file);
    const label =
      size >= 1024 * 1024
        ? `${(size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(size / 1024)} KB`;
    return { href: url('resume.pdf'), size: label };
  } catch {
    return null;
  }
}
