#!/usr/bin/env node
/**
 * Lists every placeholder (caps in square brackets) still left in src/: records first,
 * grouped by record ("DCL-101 Baur"), then any other files. Drafts are marked.
 * Run via `npm run check`. Prints a warning; never fails the build.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placeholderRegex } from '../src/lib/placeholder-pattern.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const EXTENSIONS = /\.(md|mdx|ts|astro|mjs|js)$/;
// The pattern file describes placeholders; it doesn't contain real ones.
const SKIP = new Set([join(srcDir, 'lib', 'placeholder-pattern.mjs')]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.test(entry.name) && !SKIP.has(path)) yield path;
  }
}

const recordsDir = join(srcDir, 'content', 'records');
const found = new Map();
for await (const file of walk(srcDir)) {
  const text = await readFile(file, 'utf8');
  const rel = relative(root, file);
  let label = rel;
  if (file.startsWith(recordsDir)) {
    const front = text.split(/^---$/m)[1] ?? '';
    const field = (key) => front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '?';
    const draft = /^draft:\s*true\s*$/m.test(front) ? ' (draft)' : '';
    label = `${field('catalogue')} ${field('title')}${draft}  ${rel}`;
  }
  text.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(placeholderRegex())) {
      if (!found.has(label)) found.set(label, []);
      found.get(label).push({ line: i + 1, token: match[0] });
    }
  });
}

const yellow = (s) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);

const total = [...found.values()].reduce((n, list) => n + list.length, 0);
if (total === 0) {
  console.log('\n✓ No placeholders left.');
} else {
  console.log(yellow(`\n⚠ ${total} placeholders remaining in ${found.size} files:`));
  // "DCL-…" labels (records, in catalogue order) sort before file paths.
  for (const [label, list] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n  ${label}  ${dim(`(${list.length})`)}`);
    for (const { line, token } of list)
      console.log(`    ${dim(`${String(line).padStart(4)}:`)} ${token}`);
  }
  console.log(dim('\n  (warning only: the build still passes)'));
}
