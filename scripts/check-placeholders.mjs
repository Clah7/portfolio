#!/usr/bin/env node
/**
 * Content report, run by `npm run check` after `astro check`. Warns, never fails.
 *
 * - Placeholders (caps in square brackets) left in src/, grouped by record
 *   ("DCL-101 Baur") and split into:
 *     visible on the live site: inside text with other words (the chip shows)
 *     hidden in production: a whole value, list item or paragraph (left out)
 * - public/resume.pdf missing (every resume button is then hidden).
 * - Link-preview images: public/og/home.png, and one per full-depth record,
 *   missing or older than the record file (regenerate with `npm run og`).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPlaceholder, placeholderRegex } from '../src/lib/placeholder-pattern.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const publicDir = join(root, 'public');
const recordsDir = join(srcDir, 'content', 'records');
const EXTENSIONS = /\.(md|mdx|ts|astro|mjs|js)$/;
// The pattern file describes placeholders; it doesn't contain real ones.
const SKIP = new Set([join(srcDir, 'lib', 'placeholder-pattern.mjs')]);

const yellow = (s) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.test(entry.name) && !SKIP.has(path)) yield path;
  }
}

/** The value a line holds: a YAML scalar (`key: value`, `- value`) or a Markdown paragraph. */
function lineValue(line) {
  const yaml = line.match(/^\s*(?:-\s+|[\w-]+:\s+|-\s+[\w-]+:\s+)(.*)$/);
  const raw = (yaml ? yaml[1] : line).trim();
  return raw.replace(/^(['"])(.*)\1$/, '$2').trim();
}

const meta = (front, key) => front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();

const found = new Map(); // label -> [{ line, token, hidden }]
for await (const file of walk(srcDir)) {
  const text = await readFile(file, 'utf8');
  const rel = relative(root, file);
  let label = rel;
  if (file.startsWith(recordsDir)) {
    const front = text.split(/^---$/m)[1] ?? '';
    const draft = /^draft:\s*true\s*$/m.test(front) ? ' (draft)' : '';
    label = `${meta(front, 'catalogue') ?? '?'} ${meta(front, 'title') ?? '?'}${draft}  ${rel}`;
  }
  text.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(placeholderRegex())) {
      if (!found.has(label)) found.set(label, []);
      found
        .get(label)
        .push({ line: i + 1, token: match[0], hidden: isPlaceholder(lineValue(line)) });
    }
  });
}

const all = [...found.values()].flat();
if (all.length === 0) {
  console.log(green('\n✓ No placeholders left.'));
} else {
  const visible = all.filter((p) => !p.hidden).length;
  console.log(
    yellow(
      `\n⚠ ${all.length} placeholders in ${found.size} files: ${visible} visible on the live site, ${all.length - visible} hidden in production.`,
    ),
  );
  for (const [label, list] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n  ${label}  ${dim(`(${list.length})`)}`);
    for (const { line, token, hidden } of list)
      console.log(
        `    ${dim(`${String(line).padStart(4)}:`)} ${token}  ${hidden ? dim('hidden in production') : yellow('visible on live site')}`,
      );
  }
}

// ---------- resume and link-preview images ----------

const mtime = (path) =>
  stat(path).then(
    (s) => s.mtimeMs,
    () => null,
  );
const warnings = [];

if ((await mtime(join(publicDir, 'resume.pdf'))) === null) {
  warnings.push(
    'resume.pdf missing: public/resume.pdf not found, so the resume buttons are hidden.',
  );
}

const home = await mtime(join(publicDir, 'og', 'home.png'));
if (home === null) warnings.push('og/home.png missing: run `npm run og`.');
for (const file of (await readdir(recordsDir)).filter((f) => f.endsWith('.md'))) {
  const path = join(recordsDir, file);
  const front = (await readFile(path, 'utf8')).split(/^---$/m)[1] ?? '';
  if (!/^depth:\s*full\s*$/m.test(front) || /^draft:\s*true\s*$/m.test(front)) continue;
  const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
  const image = await mtime(join(publicDir, 'og', `${slug}.png`));
  if (image === null) warnings.push(`og/${slug}.png missing: run \`npm run og\`.`);
  else if (image < (await mtime(path)))
    warnings.push(`og/${slug}.png is older than ${file}: run \`npm run og\`.`);
}

if (warnings.length) {
  console.log(yellow(`\n⚠ ${warnings.length} site file warning(s):`));
  for (const w of warnings) console.log(`  ${w}`);
} else {
  console.log(green('✓ resume.pdf and link-preview images present and up to date.'));
}
console.log(dim('\n  (warnings only: the build still passes)'));
