#!/usr/bin/env node
/**
 * The condensed portfolio PDF (`npm run pdf`, which builds with PORTFOLIO_PDF=1
 * first and rebuilds the normal site after).
 *
 * Prints the build's /pdf/portfolio/ page (src/pdf/Portfolio.astro) to
 * docs/portfolio/ with the Playwright Chromium already installed for
 * `npm run verify`. The file is gitignored: it's for sending, not the site.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { dist, serveDist } from './lib/serve-dist.mjs';

if (!existsSync(join(dist, 'pdf', 'portfolio', 'index.html'))) {
  console.error(
    'dist/pdf/portfolio/ is missing: run `npm run pdf` (it builds with PORTFOLIO_PDF=1).',
  );
  process.exit(1);
}

const outDir = fileURLToPath(new URL('../docs/portfolio', import.meta.url));
const out = join(outDir, 'Darren Christian Liharja - Portfolio.pdf');
await mkdir(outDir, { recursive: true });

const { origin, base, close } = await serveDist(Number(process.env.PDF_PORT ?? 4397));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${origin}${base}pdf/portfolio/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
await browser.close();
await close();
console.log(`✓ ${out}`);
