#!/usr/bin/env node
/**
 * Link-preview images (`npm run og`, which builds first).
 *
 * Screenshots the hidden /og/* pages of the built site at 1200×630 into
 * public/og/<name>.png (home.png plus one per full-depth record), and renders
 * the favicon onto paper as public/apple-touch-icon.png (180×180). Uses the
 * Playwright Chromium already installed for `npm run verify`. Commit the PNGs:
 * the deploy workflow doesn't run a browser. Then build again so dist/ has them.
 */
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { dist, serveDist } from './lib/serve-dist.mjs';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const outDir = join(publicDir, 'og');
await mkdir(outDir, { recursive: true });

const { origin, base, close } = await serveDist(Number(process.env.OG_PORT ?? 4396));
const names = (await readdir(join(dist, 'og'), { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const name of names) {
  await page.goto(`${origin}${base}og/${name}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(outDir, `${name}.png`),
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  console.log(`✓ public/og/${name}.png`);
}

// apple-touch-icon: the favicon record on paper (iOS doesn't do transparency).
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(
  `<body style="margin:0;background:#F3EDE2;display:grid;place-items:center;width:180px;height:180px">
     <img src="${origin}${base}favicon.svg" width="150" height="150" alt="">
   </body>`,
);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: join(publicDir, 'apple-touch-icon.png') });
console.log('✓ public/apple-touch-icon.png');

await browser.close();
await close();
console.log('\nCommit public/og/ and public/apple-touch-icon.png, then `npm run build`.');
