#!/usr/bin/env node
/**
 * Browser audit of the built site (run `npm run build` first).
 *
 * Serves dist/ under its configured base, then for every page at desktop and
 * mobile widths checks: axe violations, horizontal page scroll, interactive
 * targets under 44×44 px and requests to Google Fonts. It also runs Lighthouse
 * on the homepage and the first liner-notes page, and checks that no HTML page
 * loads three.js up front (a lazy import() chunk is fine). If the homepage has
 * a crate, it also drives it by keyboard, mouse-free play and touch, and checks
 * reduced motion. If it has Now Playing, it opens every record in the panel
 * and the mobile sheet (axe, 44px targets), and checks focus, ?record= and
 * Back/Forward, the gallery, the lightbox, the YouTube facade (no request
 * before the click), Pause and reduced motion. Lighthouse also runs with a
 * record playing. Phase 3: the three.js turntable runs its play sequence on
 * desktop for a 12in and a 7in record (screenshots per phase in
 * docs/screenshots/phase-3/), deep links start spinning, and mobile, reduced
 * motion, Save-Data and disabled WebGL keep the CSS turntable without loading
 * three.js; the lazy chunk's gzipped size is checked against its 200 KB budget.
 *
 * It also checks the content: every published record is in the plain list,
 * liner-notes pages exist for exactly the full-depth records, and drafts appear
 * nowhere in the build.
 *
 * Exits 1 on any failure; Lighthouse scores other than accessibility are
 * reported but don't fail the run. VERIFY_SKIP_LIGHTHOUSE=1 skips Lighthouse
 * (e.g. for a second run against a build with a different base).
 * First run: `npx playwright install chromium`.
 */
import { createServer } from 'node:http';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const recordsDir = fileURLToPath(new URL('../src/content/records', import.meta.url));
const PORT = Number(process.env.VERIFY_PORT ?? 4398);
const CDP_PORT = PORT + 1;
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

const failures = [];
const fail = (msg) => failures.push(msg);
const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const [red, green, yellow, dim] = [31, 32, 33, 2].map(color);

// ---------- setup ----------

try {
  await stat(join(dist, 'index.html'));
} catch {
  console.error(red('dist/index.html not found. Run `npm run build` first.'));
  process.exit(1);
}

// The canonical link tells us which base the build was made for (e.g. /portfolio/).
const homeHtml = await readFile(join(dist, 'index.html'), 'utf8');
const canonical = homeHtml.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
const base = canonical ? new URL(canonical).pathname.replace(/\/?$/, '/') : '/';

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

const pages = [];
for await (const file of htmlFiles(dist)) {
  const rel = file.slice(dist.length + 1).replace(/index\.html$/, '');
  if (rel.endsWith('.html')) continue; // e.g. 404.html
  pages.push(base + rel);
}
pages.sort((a, b) => a.length - b.length || a.localeCompare(b));

// ---------- content: published records, liner-notes pages, drafts ----------

const records = [];
for (const file of (await readdir(recordsDir)).filter((f) => f.endsWith('.md'))) {
  const front = (await readFile(join(recordsDir, file), 'utf8')).split(/^---$/m)[1] ?? '';
  records.push({
    slug: file.replace(/^\d+-/, '').replace(/\.md$/, ''),
    section: front.match(/^section:\s*(\S+)/m)?.[1],
    full: /^depth:\s*full\s*$/m.test(front),
    draft: /^draft:\s*true\s*$/m.test(front),
  });
}
const published = records.filter((r) => !r.draft);
const totalRecords = published.length;
/** Published records per crate section, e.g. { projects: 5, … }. */
const perSection = Object.fromEntries(
  ['projects', 'experience', 'community', 'honors'].map((id) => [
    id,
    published.filter((r) => r.section === id).length,
  ]),
);
{
  const want = published
    .filter((r) => r.full)
    .map((r) => `${base}records/${r.slug}/`)
    .sort();
  const have = pages.filter((p) => p.startsWith(`${base}records/`)).sort();
  const listed = [...homeHtml.matchAll(/<li id="rec-([^"]+)"/g)].map((m) => m[1]);
  const results = [
    [
      JSON.stringify(want) === JSON.stringify(have),
      `liner-notes pages for exactly the ${want.length} full-depth records (built ${have.length})`,
    ],
    [
      listed.length === totalRecords && published.every((r) => listed.includes(r.slug)),
      `plain list has all ${totalRecords} published records (found ${listed.length})`,
    ],
  ];
  for (const draft of records.filter((r) => r.draft)) {
    let leaked = false;
    for (const page of pages) {
      const html = await readFile(join(dist, page.slice(base.length), 'index.html'), 'utf8');
      if (html.includes(`rec-${draft.slug}"`) || html.includes(`/records/${draft.slug}/`))
        leaked = true;
    }
    results.push([!leaked, `draft "${draft.slug}" appears nowhere in the build`]);
  }
  for (const [ok, msg] of results) {
    console.log(`${ok ? green('✓') : red('✗')} content: ${msg}`);
    if (!ok) fail(`content: ${msg}`);
  }
  console.log('');
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(base)) return res.writeHead(404).end();
  let file = normalize(join(dist, path.slice(base.length)));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));
const origin = `http://localhost:${PORT}`;
console.log(dim(`Serving dist/ at ${origin}${base} (${pages.length} pages)\n`));

const browser = await chromium.launch({ args: [`--remote-debugging-port=${CDP_PORT}`] });

// ---------- per-page browser checks ----------

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const fontCdn = new Set();
  page.on('request', (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontCdn.add(r.url());
  });

  for (const path of pages) {
    const label = `${name.padEnd(7)} ${path}`;
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    const problems = [];

    const axe = await new AxeBuilder({ page }).analyze();
    for (const v of axe.violations) problems.push(`axe ${v.id} (${v.nodes.length}): ${v.help}`);

    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      problems.push('horizontal page scroll');
    }

    // Inline links inside running prose are exempt (WCAG 2.5.8).
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, [role="button"]')]
        .filter((el) => !el.closest('.prose, p'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.textContent ?? '').trim().slice(0, 30), w: r.width, h: r.height };
        })
        .filter(({ w, h }) => w > 0 && (w < 44 || h < 44)),
    );
    for (const s of small)
      problems.push(`target under 44px: "${s.text}" ${Math.round(s.w)}×${Math.round(s.h)}`);

    if (problems.length) {
      console.log(`${red('✗')} ${label}`);
      for (const p of problems) {
        console.log(`    ${p}`);
        fail(`${label}: ${p}`);
      }
    } else {
      console.log(`${green('✓')} ${label}`);
    }
  }

  for (const url of fontCdn) fail(`${name}: request to Google Fonts ${url}`);
  await context.close();
}

// ---------- crate: tabs, keyboard, play event, deep links, reduced motion ----------

console.log('');
{
  const crateResults = [];
  const check = (ok, msg) => {
    crateResults.push([ok, msg]);
    if (!ok) fail(`crate: ${msg}`);
  };
  // Takes over record:play before Now Playing sees it (capture on window), so
  // these checks see the raw event and nothing opens.
  const captureHandler = () => {
    window.__plays = [];
    window.addEventListener(
      'record:play',
      (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.__plays.push(`${e.detail.slug}:${e.detail.depth}`);
      },
      true,
    );
  };
  const OPEN = '[data-crate] [data-crate-panel]:not([hidden])';

  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  await page.goto(origin + base, { waitUntil: 'networkidle' });

  if ((await page.locator('[data-crate]').count()) === 0) {
    console.log(dim('No [data-crate] on the homepage; crate checks skipped.'));
  } else {
    const sleevesIn = (p) =>
      p.locator(`${OPEN} a[data-slug]`).evaluateAll((els) =>
        els.map((el) => ({
          slug: el.dataset.slug,
          depth: el.dataset.depth,
          label: `${el.dataset.catalogue} ${el.dataset.title}`,
        })),
      );
    const focused = (p = page) =>
      p.evaluate(() => document.activeElement?.getAttribute('data-slug') ?? null);
    const focusedTab = (p = page) =>
      p.evaluate(() => document.activeElement?.closest('[role="tab"]')?.dataset.section ?? null);
    const selectedTab = (p = page) =>
      p.locator('[data-crate] [role="tab"][aria-selected="true"]').getAttribute('data-section');
    const status = () => page.locator('[data-crate-status]').textContent();
    const tabNames = await page
      .locator('[data-crate] [role="tab"]')
      .evaluateAll((els) => els.map((el) => el.dataset.section));

    // Structure
    const info = await sleevesIn(page);
    const n = info.length;
    check(
      JSON.stringify(tabNames) ===
        JSON.stringify(['projects', 'experience', 'community', 'honors']),
      `four divider tabs in order (${tabNames.join(', ')})`,
    );
    check(
      (await selectedTab()) === 'projects' && n === perSection.projects,
      `Projects opens by default (${n} sleeves)`,
    );
    const panelOk = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[data-crate] [role="tab"]')];
      return tabs.every((t) => {
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        return (
          panel?.getAttribute('role') === 'tabpanel' &&
          panel.getAttribute('aria-labelledby') === t.id &&
          panel.hidden === (t.getAttribute('aria-selected') !== 'true')
        );
      });
    });
    check(panelOk, 'each tab controls a labelled tabpanel; only the selected one is shown');
    const tabbable = await page.locator(`${OPEN} a[data-slug][tabindex="0"]`).count();
    check(tabbable === 1, `exactly one sleeve in the tab order (found ${tabbable})`);

    // Tab order: header → tabs (one stop) → sleeves (one stop)
    await page.locator('header nav a').last().focus();
    await page.keyboard.press('Tab');
    check((await focusedTab()) === 'projects', 'Tab enters the divider tabs on the selected tab');
    await page.keyboard.press('Tab');
    check((await focused()) === info[0].slug, 'the next Tab enters the crate on the first sleeve');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    check((await focused()) === info[2].slug, '→ → moves to the third sleeve');
    const expected = `${info[2].label}, 3 of ${n}`;
    check(
      (await status()) === expected,
      `live region reads "${expected}" (got "${await status()}")`,
    );
    await page.keyboard.press('End');
    check((await focused()) === info[n - 1].slug, 'End jumps to the last sleeve');
    await page.keyboard.press('ArrowRight');
    check((await focused()) === info[n - 1].slug, '→ on the last sleeve stays put');
    await page.keyboard.press('Home');
    check((await focused()) === info[0].slug, 'Home jumps to the first sleeve');
    await page.keyboard.press('ArrowLeft');
    check((await focused()) === info[0].slug, '← on the first sleeve stays put');

    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Tab');
    check((await focused()) === null, 'Tab leaves the crate (one tab stop)');
    await page.keyboard.press('Shift+Tab');
    check((await focused()) === info[n - 2].slug, 'Shift+Tab returns to the last active sleeve');

    await page.evaluate(captureHandler);
    const before = page.url();
    await page.keyboard.press(' ');
    await page.keyboard.press('Enter');
    const plays = await page.evaluate(() => window.__plays);
    const want = `${info[n - 2].slug}:${info[n - 2].depth}`;
    check(
      plays.length === 2 && plays.every((s) => s === want) && page.url() === before,
      `Space and Enter dispatch record:play {slug, depth} (${JSON.stringify(plays)}) and a handler can cancel`,
    );

    // Tabs: arrows move focus (manual activation), Enter selects
    await page.goto(origin + base, { waitUntil: 'networkidle' });
    await page.locator('[data-crate] [role="tab"][aria-selected="true"]').focus();
    await page.keyboard.press('ArrowLeft');
    check((await focusedTab()) === 'honors', '← on the first tab wraps to the last');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    check(
      (await focusedTab()) === 'experience' && (await selectedTab()) === 'projects',
      '→ moves focus between tabs without switching sections',
    );
    await page.keyboard.press('Enter');
    const exp = await sleevesIn(page);
    check(
      (await selectedTab()) === 'experience' && exp.length === perSection.experience,
      `Enter opens Experience (${exp.length} sleeves)`,
    );
    check(
      (await status()) === `Experience: ${perSection.experience} records`,
      `section change is announced (got "${await status()}")`,
    );
    check(
      new URL(page.url()).searchParams.get('crate') === 'experience',
      'switching sections updates ?crate=',
    );
    await page.keyboard.press('Tab');
    check((await focused()) === exp[0].slug, 'Tab moves from the tabs into the open section');

    // Deep links
    await page.goto(`${origin + base}?crate=honors`, { waitUntil: 'networkidle' });
    check(
      (await selectedTab()) === 'honors' && (await sleevesIn(page)).length === perSection.honors,
      `?crate=honors opens Honors under ${base}`,
    );
    await page.goto(`${origin + base}?crate=nope`, { waitUntil: 'networkidle' });
    check((await selectedTab()) === 'projects', 'an unknown ?crate= falls back to Projects');

    // Every title is readable without hover: nothing covers it, nothing overflows.
    // …also while a record is playing: the pulled sleeve must not hide the
    // titles behind it, and its "Now playing" tag must not cover its own title.
    for (const width of [1440, 1024]) {
      const tp = await context.newPage();
      await tp.setViewportSize({ width, height: 900 });
      for (const section of tabNames) {
        for (const playing of [false, true]) {
          await tp.goto(`${origin + base}?crate=${section}`, { waitUntil: 'networkidle' });
          if (playing) {
            await tp.locator(`${OPEN} a[data-slug]`).first().focus();
            await tp.keyboard.press('Enter');
            await tp.evaluate(() => {
              document.activeElement?.blur();
              window.scrollTo({ top: 0, behavior: 'instant' });
            });
            await tp.waitForTimeout(400);
          }
          const hidden = await tp.evaluate((sel) => {
            const bad = [];
            for (const sleeve of document.querySelectorAll(`${sel} a[data-slug]`)) {
              const title = sleeve.querySelector('.title');
              if (title.scrollWidth > title.clientWidth + 1)
                bad.push(`${sleeve.dataset.slug} overflows`);
              if (sleeve.getAttribute('aria-current') === 'true') {
                const tag = getComputedStyle(sleeve, '::after');
                const tagLeft = parseFloat(tag.left);
                const tagBottom = parseFloat(tag.top) + parseFloat(tag.height);
                const head = title.parentElement;
                const titleRight = head.offsetLeft + title.offsetLeft + title.offsetWidth;
                const titleTop = head.offsetTop + title.offsetTop;
                if (titleRight > tagLeft + 1 && titleTop < tagBottom - 1)
                  bad.push(`${sleeve.dataset.slug} title under its tag`);
              }
              const r = title.getBoundingClientRect();
              for (const fx of [0.15, 0.5, 0.85]) {
                for (const fy of [0.3, 0.7]) {
                  const top = document.elementFromPoint(
                    r.left + r.width * fx,
                    r.top + r.height * fy,
                  );
                  if (!sleeve.contains(top)) {
                    bad.push(`${sleeve.dataset.slug} covered`);
                    return bad;
                  }
                }
              }
            }
            return bad;
          }, OPEN);
          check(
            hidden.length === 0,
            `${width}px ${section}${playing ? ' (first record playing)' : ''}: every title visible ${hidden.length ? JSON.stringify(hidden) : ''}`,
          );
        }
      }
      await tp.close();
    }

    // Motion: transitions run normally and drop to ~0 under reduced motion.
    await page.goto(origin + base, { waitUntil: 'networkidle' });
    const duration = (p) =>
      p
        .locator(`${OPEN} a[data-slug]`)
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) * 1000);
    check((await duration(page)) > 50, 'sleeve lift has a transition normally');
    const reduced = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      reducedMotion: 'reduce',
    });
    const rpage = await reduced.newPage();
    await rpage.goto(origin + base, { waitUntil: 'networkidle' });
    const rd = await duration(rpage);
    check(rd <= 0.01, `no transition under prefers-reduced-motion (${rd}ms)`);
    await rpage.locator('[data-crate] [role="tab"][data-section="community"]').click();
    const anim = await rpage
      .locator(`${OPEN} .slot`)
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration) * 1000);
    check(anim <= 0.01, `section flip is instant under prefers-reduced-motion (${anim}ms)`);
    await reduced.close();

    // Mobile: chips, and a tap plays.
    const mobile = await browser.newContext({
      viewport: VIEWPORTS.mobile,
      hasTouch: true,
      isMobile: true,
    });
    const mpage = await mobile.newPage();
    await mpage.goto(origin + base, { waitUntil: 'networkidle' });
    check(
      await mpage.locator('[data-crate] [role="tablist"]').isVisible(),
      'mobile shows the section chips',
    );
    await mpage.locator('[data-crate] [role="tab"][data-section="community"]').tap();
    await mpage.evaluate(captureHandler);
    const first = mpage.locator(`${OPEN} a[data-slug]`).first();
    const firstSlug = await first.getAttribute('data-slug');
    await first.tap();
    const taps = await mpage.evaluate(() => window.__plays);
    check(
      taps.length === 1 && taps[0] === `${firstSlug}:card`,
      `mobile chip switches section and a tap dispatches record:play (${JSON.stringify(taps)})`,
    );
    await mobile.close();

    // No JS: every section is a headed group of plain links.
    const nojs = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      javaScriptEnabled: false,
    });
    const npage = await nojs.newPage();
    await npage.goto(origin + base, { waitUntil: 'networkidle' });
    const headings = await npage.locator('[data-crate] .panel-h:visible').count();
    const links = await npage.locator('[data-crate] a[data-slug]:visible').count();
    const tablistShown = await npage.locator('[data-crate] [role="tablist"]').isVisible();
    check(
      headings === 4 && links === totalRecords && !tablistShown,
      `without JS: 4 headed groups, ${links}/${totalRecords} sleeve links, no tabs`,
    );
    await nojs.close();

    for (const [ok, msg] of crateResults)
      console.log(`${ok ? green('✓') : red('✗')} crate: ${msg}`);
  }
  await context.close();
}

// ---------- Now Playing: panel, sheet, history, stages ----------

console.log('');
{
  const results = [];
  const check = (ok, msg) => {
    results.push([ok, msg]);
    if (!ok) fail(`now playing: ${msg}`);
  };
  const OPEN = '[data-crate] [data-crate-panel]:not([hidden])';
  const ytRequests = [];
  const watchYouTube = (p) =>
    p.on('request', (r) => {
      if (/youtube|ytimg|googlevideo/.test(r.url())) ytRequests.push(r.url());
    });
  const state = (p) =>
    p.evaluate(() => {
      const url = new URL(location.href);
      return {
        record: url.searchParams.get('record'),
        crate: url.searchParams.get('crate'),
        panelOpen: !document.querySelector('[data-np-panel]')?.hidden,
        sheetOpen: Boolean(document.querySelector('[data-np-sheet]')?.open),
        playing: document.querySelector('[data-np-root]')?.dataset.slug ?? null,
        focus: document.activeElement?.id || document.activeElement?.dataset?.slug || null,
        current:
          document.querySelector('[data-crate] a[aria-current="true"]')?.dataset.slug ?? null,
        status: document.querySelector('[data-crate-status]')?.textContent ?? '',
      };
    });
  const axeProblems = async (p, label) => {
    const axe = await new AxeBuilder({ page: p }).analyze();
    return axe.violations.map((v) => `${label}: axe ${v.id} (${v.nodes.length})`);
  };

  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  watchYouTube(page);
  await page.goto(origin + base, { waitUntil: 'networkidle' });

  if ((await page.locator('[data-np-panel]').count()) === 0) {
    console.log(dim('No Now Playing on the homepage; checks skipped.'));
  } else {
    // What's on each record's stage (from the templates).
    const kinds = await page.evaluate(() =>
      [...document.querySelectorAll('template[data-np]')].map((t) => ({
        slug: t.dataset.np,
        gallery: Boolean(t.content.querySelector('[data-gallery-next]')),
        yt: Boolean(t.content.querySelector('[data-yt]')),
        cert: Boolean(t.content.querySelector('[data-lightbox-open]')),
        video: Boolean(t.content.querySelector('[data-stage-video]')),
      })),
    );
    check(kinds.length === totalRecords, `one Now Playing template per record (${kinds.length})`);

    // Keyboard: Enter on a sleeve opens the panel and focuses its heading.
    const sleeves = await page.locator(`${OPEN} a[data-slug]`).evaluateAll((els) =>
      els.map((el) => ({
        slug: el.dataset.slug,
        label: `${el.dataset.catalogue} ${el.dataset.title}`,
      })),
    );
    await page.locator(`${OPEN} a[data-slug]`).first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    let s = await state(page);
    check(
      s.panelOpen && s.playing === sleeves[0].slug && s.focus === 'np-title',
      `Enter opens the panel for ${sleeves[0].slug} and focuses its heading (focus: ${s.focus})`,
    );
    check(
      s.record === sleeves[0].slug && s.crate === 'projects',
      `URL gets ?record=${s.record}&crate=${s.crate}`,
    );
    check(s.current === sleeves[0].slug, 'the sleeve is pulled (aria-current="true")');
    check(
      s.status === `Now playing: ${sleeves[0].label}`,
      `announces "Now playing: ${sleeves[0].label}" (got "${s.status}")`,
    );
    const p1 = await axeProblems(page, 'panel');
    check(p1.length === 0, `axe clean with the panel open ${p1.join('; ')}`);

    // Put it back
    await page.locator('[data-np-panel] .back').click();
    await page.waitForTimeout(100);
    s = await state(page);
    check(
      !s.panelOpen && s.record === null && s.focus === sleeves[0].slug && s.current === null,
      '"Put it back in the crate" closes it, clears ?record= and focuses the sleeve',
    );

    // History: play two records, then Back, Back, Forward.
    for (const i of [0, 1]) {
      await page.locator(`${OPEN} a[data-slug]`).nth(i).focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    await page.goBack();
    await page.waitForTimeout(150);
    const back1 = (await state(page)).playing;
    await page.goBack();
    await page.waitForTimeout(150);
    const back2 = await state(page);
    await page.goForward();
    await page.waitForTimeout(150);
    const fwd = (await state(page)).playing;
    check(
      back1 === sleeves[0].slug &&
        !back2.panelOpen &&
        back2.playing === null &&
        fwd === sleeves[0].slug,
      `Back goes to the previous record, then closes; Forward reopens (${back1} → ${back2.playing} → ${fwd})`,
    );

    // Deep link to a record in another section: opens it, no tonearm swing.
    const honors = kinds.find((k) => k.cert);
    const deep = honors?.slug ?? kinds.at(-1).slug;
    await page.goto(`${origin + base}?record=${deep}`, { waitUntil: 'networkidle' });
    s = await state(page);
    const arm = await page
      .locator('[data-np-panel] .tonearm')
      .evaluate((el) => getComputedStyle(el).animationName);
    const tab = await page
      .locator('[data-crate] [role="tab"][aria-selected="true"]')
      .getAttribute('data-section');
    check(
      s.panelOpen && s.playing === deep && s.current === deep && arm === 'none' && tab === s.crate,
      `?record=${deep} opens it directly (${tab} divider, no tonearm swing)`,
    );

    // Every record's panel: axe clean.
    const panelIssues = [];
    for (const { slug } of kinds) {
      await page.goto(`${origin + base}?record=${slug}`, { waitUntil: 'networkidle' });
      panelIssues.push(...(await axeProblems(page, slug)));
    }
    check(
      panelIssues.length === 0,
      `axe clean on all ${kinds.length} panels ${panelIssues.join('; ')}`,
    );

    // Gallery
    const gallery = kinds.find((k) => k.gallery);
    if (gallery) {
      await page.goto(`${origin + base}?record=${gallery.slug}`, { waitUntil: 'networkidle' });
      const counter = page.locator('[data-np-panel] [data-gallery-counter]');
      const before = (await counter.textContent())?.trim();
      await page.locator('[data-np-panel] [data-gallery-next]').click();
      await page.waitForTimeout(700);
      const after = (await counter.textContent())?.trim();
      check(
        before?.startsWith('1 of') && after?.startsWith('2 of'),
        `gallery Next moves the counter (${before} → ${after})`,
      );
    }

    // YouTube facade: nothing from YouTube until it's pressed.
    const yt = kinds.find((k) => k.yt);
    if (yt) {
      ytRequests.length = 0;
      await page.goto(`${origin + base}?record=${yt.slug}`, { waitUntil: 'networkidle' });
      const beforeClick = ytRequests.length;
      await page.locator('[data-np-panel] [data-yt-play]').click();
      const title = await page.locator('[data-np-panel] iframe').getAttribute('title');
      const src = await page.locator('[data-np-panel] iframe').getAttribute('src');
      check(
        beforeClick === 0 &&
          Boolean(title) &&
          src.startsWith('https://www.youtube-nocookie.com/embed/'),
        `YouTube loads only after the click (${beforeClick} requests before; iframe "${title}")`,
      );
    }

    // Certificate lightbox
    const cert = kinds.find((k) => k.cert);
    if (cert) {
      await page.goto(`${origin + base}?record=${cert.slug}`, { waitUntil: 'networkidle' });
      await page.locator('[data-np-panel] [data-lightbox-open]').click();
      const opened = await page
        .locator('[data-np-panel] dialog[data-lightbox]')
        .evaluate((d) => d.open);
      const lb = await axeProblems(page, 'lightbox');
      await page.keyboard.press('Escape');
      const closed = await page
        .locator('[data-np-panel] dialog[data-lightbox]')
        .evaluate((d) => !d.open);
      const back = await page.evaluate(() =>
        document.activeElement?.hasAttribute('data-lightbox-open'),
      );
      check(
        opened && closed && back && lb.length === 0,
        `certificate opens a lightbox; Esc closes it and returns focus ${lb.join('; ')}`,
      );
    }

    // Pause: spin pauses, aria-pressed flips.
    await page.goto(`${origin + base}?record=${kinds[0].slug}`, { waitUntil: 'networkidle' });
    await page.locator('[data-np-panel] [data-np-pause]').click();
    const paused = await page.evaluate(() => ({
      pressed: document
        .querySelector('[data-np-panel] [data-np-pause]')
        ?.getAttribute('aria-pressed'),
      play: getComputedStyle(document.querySelector('[data-np-panel] .record')).animationPlayState,
    }));
    check(
      paused.pressed === 'true' && paused.play === 'paused',
      `Pause stops the spin (aria-pressed ${paused.pressed}, ${paused.play})`,
    );
    await context.close();

    // Reduced motion: nothing spins, no tonearm swing, nothing to pause.
    const reduced = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      reducedMotion: 'reduce',
    });
    const rpage = await reduced.newPage();
    await rpage.goto(origin + base, { waitUntil: 'networkidle' });
    await rpage.locator(`${OPEN} a[data-slug]`).first().click();
    await rpage.waitForTimeout(150);
    const motion = await rpage.evaluate(() => {
      const ms = (el) => parseFloat(getComputedStyle(el).animationDuration) * 1000;
      const panel = document.querySelector('[data-np-panel]');
      return {
        record: ms(panel.querySelector('.record')),
        arm: ms(panel.querySelector('.tonearm')),
        pauseHidden: panel.querySelector('[data-np-pause]')?.hidden,
        autoplay: [...panel.querySelectorAll('video')].some((v) => !v.paused),
      };
    });
    check(
      motion.record <= 0.01 && motion.arm <= 0.01 && !motion.autoplay,
      `reduced motion: record and tonearm still (${motion.record}ms, ${motion.arm}ms), no video autoplay`,
    );
    await reduced.close();

    // Mobile: tap opens the bottom sheet; Esc closes it and returns focus.
    const mobile = await browser.newContext({
      viewport: VIEWPORTS.mobile,
      hasTouch: true,
      isMobile: true,
    });
    const mpage = await mobile.newPage();
    await mpage.goto(origin + base, { waitUntil: 'networkidle' });
    const msleeve = mpage.locator(`${OPEN} a[data-slug]`).first();
    const mslug = await msleeve.getAttribute('data-slug');
    await msleeve.tap();
    await mpage.waitForTimeout(400);
    s = await state(mpage);
    check(
      s.sheetOpen && s.playing === mslug && s.focus === 'np-title',
      `mobile: a tap opens the bottom sheet with focus on its heading`,
    );
    const sheetIssues = [];
    for (const { slug } of kinds) {
      await mpage.goto(`${origin + base}?record=${slug}`, { waitUntil: 'networkidle' });
      sheetIssues.push(...(await axeProblems(mpage, `sheet ${slug}`)));
      const sm = await mpage.evaluate(() => {
        const small = [
          ...document.querySelectorAll('[data-np-sheet] a[href], [data-np-sheet] button'),
        ]
          .filter((el) => !el.closest('.body, p'))
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44));
        return small.length;
      });
      if (sm) sheetIssues.push(`sheet ${slug}: ${sm} target(s) under 44px`);
    }
    check(
      sheetIssues.length === 0,
      `axe clean and 44px targets on all ${kinds.length} sheets ${sheetIssues.join('; ')}`,
    );
    await mpage.goto(origin + base, { waitUntil: 'networkidle' });
    await mpage.locator(`${OPEN} a[data-slug]`).first().tap();
    await mpage.waitForTimeout(400);
    await mpage.keyboard.press('Escape');
    await mpage.waitForTimeout(200);
    s = await state(mpage);
    check(
      !s.sheetOpen && s.record === null && s.focus === mslug,
      `mobile: Esc closes the sheet, clears ?record= and focuses the sleeve (focus: ${s.focus})`,
    );
    await mobile.close();

    for (const [ok, msg] of results)
      console.log(`${ok ? green('✓') : red('✗')} now playing: ${msg}`);
  }
}

// ---------- three.js turntable (Phase 3) ----------

console.log('');
{
  const results = [];
  const check = (ok, msg) => {
    results.push([ok, msg]);
    if (!ok) fail(`3d: ${msg}`);
  };
  const OPEN = '[data-crate] [data-crate-panel]:not([hidden])';
  const shots = fileURLToPath(new URL('../docs/screenshots/phase-3/', import.meta.url));
  await mkdir(shots, { recursive: true });
  const threeRequests = (p) => {
    const urls = [];
    p.on('request', (r) => {
      if (/\/three\.[\w-]+\.js$/.test(new URL(r.url()).pathname)) urls.push(r.url());
    });
    return urls;
  };
  const stateIs = (p, state, timeout = 60000) =>
    p
      .waitForFunction((s) => document.querySelector('.tt3d')?.dataset.state === s, state, {
        timeout,
      })
      .then(() => true)
      .catch(() => false);
  // Record every state the 3D deck passes through.
  const trackStates = () => {
    window.__tt3d = [];
    const observer = new MutationObserver(() => {
      const s = document.querySelector('.tt3d')?.dataset.state;
      if (s && window.__tt3d.at(-1) !== s) window.__tt3d.push(s);
    });
    const start = () =>
      observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state'],
      });
    // Init scripts run before <html> exists: start once the document does.
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
  };
  const play = async (p, slug) => {
    await p.locator(`[data-crate] a[data-slug="${slug}"]`).focus();
    await p.keyboard.press('Enter');
  };

  // Bundle: three.js only in its lazy chunk.
  const chunks = (await readdir(join(dist, '_astro'))).filter((f) => /^three\.[\w-]+\.js$/.test(f));
  if (chunks.length === 1) {
    const bytes = await readFile(join(dist, '_astro', chunks[0]));
    const gz = gzipSync(bytes).length;
    check(
      gz <= 200 * 1024,
      `three.js lazy chunk ${chunks[0]}: ${Math.round(bytes.length / 1024)} KB, ${(gz / 1024).toFixed(1)} KB gzipped (budget 200)`,
    );
  } else {
    check(false, `expected one three.js chunk (found ${chunks.length})`);
  }

  // Desktop: the full sequence for a 12in and a 7in record.
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  await page.addInitScript(trackStates);
  await page.goto(origin + base, { waitUntil: 'networkidle' });
  if ((await page.locator('[data-np-panel]').count()) === 0) {
    console.log(dim('No Now Playing on the homepage; 3D checks skipped.'));
  } else {
    const formats = await page
      .locator(`${OPEN} a[data-slug]`)
      .evaluateAll((els) =>
        els.map((el) => ({ slug: el.dataset.slug, format: el.dataset.format })),
      );
    const picks = [
      formats.find((f) => f.format === '12in'),
      formats.find((f) => f.format === '7in'),
    ].filter(Boolean);
    await page.locator('[data-crate]').hover();
    const ready = await page
      .waitForFunction(() => document.documentElement.dataset.turntable, null, { timeout: 60000 })
      .then(() => page.evaluate(() => document.documentElement.dataset.turntable))
      .catch(() => null);
    check(ready === '3d', `hovering the crate prefetches and builds the 3D deck (${ready})`);
    for (const { slug, format } of picks) {
      await page.evaluate(() => (window.__tt3d = []));
      await play(page, slug);
      const deck = page.locator('[data-np-panel] .deck');
      const dropped = await stateIs(page, 'cueing');
      await deck.screenshot({ path: join(shots, `${slug}-1-dropped.png`) });
      const cued = await stateIs(page, 'spinning');
      await deck.screenshot({ path: join(shots, `${slug}-2-cued.png`) });
      await page.waitForTimeout(1000);
      await deck.screenshot({ path: join(shots, `${slug}-3-spinning.png`) });
      const look = await page.evaluate(() => ({
        canvas: document.querySelectorAll('[data-np-panel] .deck-area .tt3d canvas').length,
        on: document.querySelector('[data-np-panel] .deck-area')?.dataset.tt3d,
        plinth: getComputedStyle(document.querySelector('[data-np-panel] .plinth')).opacity,
        states: window.__tt3d,
      }));
      check(
        dropped && cued && look.canvas === 1 && look.on === 'on' && look.plinth === '0',
        `${format} ${slug}: canvas over a hidden CSS deck; ${look.states.join(' → ')}`,
      );
    }
    // Pause spins down (the arm stays down); resume spins back up.
    await page.locator('[data-np-panel] [data-np-pause]').click();
    const pausedOk = await stateIs(page, 'paused', 5000);
    await page.locator('[data-np-panel] [data-np-pause]').click();
    const resumed = await stateIs(page, 'spinning', 5000);
    check(pausedOk && resumed, 'Pause stops the 3D record and resumes it');
    // Rapid switching never leaves a broken state.
    for (const { slug } of formats.slice(0, 3)) {
      await play(page, slug);
      await page.waitForTimeout(250);
    }
    const last = formats.slice(0, 3).at(-1).slug;
    const settled = await stateIs(page, 'spinning', 20000);
    const playingNow = await page.evaluate(
      () => document.querySelector('[data-np-root]')?.dataset.slug,
    );
    check(
      settled && playingNow === last,
      `switching records mid-sequence settles on the last one (${playingNow})`,
    );
  }
  await context.close();

  // Deep link: already spinning, no drop.
  const deep = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const dpage = await deep.newPage();
  await dpage.addInitScript(trackStates);
  await dpage.goto(`${origin + base}?record=earthhunt`, { waitUntil: 'networkidle' });
  // Until the first interaction the CSS deck spins; the 3D deck loads then.
  await dpage.mouse.move(300, 300, { steps: 4 });
  const deepSpinning = await stateIs(dpage, 'spinning');
  const deepStates = await dpage.evaluate(() => window.__tt3d);
  check(
    deepSpinning && !deepStates.includes('dropping'),
    `?record=earthhunt renders the record already playing (${deepStates.join(' → ')})`,
  );
  await deep.close();

  // Fallbacks: mobile, reduced motion, Save-Data and no WebGL keep the CSS turntable.
  const fallbackCase = async (label, contextOptions, initScript, launchArgs) => {
    const b = launchArgs ? await chromium.launch({ args: launchArgs }) : browser;
    const ctx = await b.newContext(contextOptions);
    const p = await ctx.newPage();
    const requested = threeRequests(p);
    if (initScript) await p.addInitScript(initScript);
    await p.goto(origin + base, { waitUntil: 'networkidle' });
    await p
      .locator('[data-crate]')
      .hover()
      .catch(() => {});
    const sleeve = p.locator(`${OPEN} a[data-slug]`).first();
    if (contextOptions.hasTouch) await sleeve.tap();
    else {
      await sleeve.focus();
      await p.keyboard.press('Enter');
    }
    await p.waitForTimeout(1500);
    const state = await p.evaluate(() => ({
      canvas: document.querySelectorAll('.tt3d canvas').length,
      open:
        !document.querySelector('[data-np-panel]').hidden ||
        document.querySelector('[data-np-sheet]').open,
    }));
    check(
      state.canvas === 0 && state.open && requested.length === 0,
      `${label}: CSS turntable, panel works, no three.js requested`,
    );
    await ctx.close();
    if (launchArgs) await b.close();
  };
  await fallbackCase('mobile 390px', {
    viewport: VIEWPORTS.mobile,
    hasTouch: true,
    isMobile: true,
  });
  await fallbackCase('reduced motion', { viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
  await fallbackCase('Save-Data', { viewport: VIEWPORTS.desktop }, () =>
    Object.defineProperty(navigator, 'connection', { value: { saveData: true } }),
  );
  await fallbackCase('WebGL disabled', { viewport: VIEWPORTS.desktop }, null, [
    '--disable-webgl',
    '--disable-3d-apis',
  ]);

  for (const [ok, msg] of results) console.log(`${ok ? green('✓') : red('✗')} 3d: ${msg}`);
  console.log(dim(`    screenshots: docs/screenshots/phase-3/`));
}

// ---------- three.js must not load up front ----------

/** Entry scripts of a page plus everything they import statically. */
async function staticScripts(html) {
  const seen = new Set();
  const queue = [
    ...html.matchAll(/<script[^>]+src="([^"]+)"|<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
  ]
    .map((m) => m[1] ?? m[2])
    .filter((src) => src.startsWith(base))
    .map((src) => join(dist, src.slice(base.length)));
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const code = await readFile(file, 'utf8').catch(() => '');
    // Static `import ... from "./x.js"` and `import "./x.js"`, not dynamic import("./x.js").
    for (const m of code.matchAll(/(?:from|import)\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      queue.push(join(file, '..', m[1]));
    }
  }
  return seen;
}

let threeUpFront = false;
for (const path of pages) {
  const html = await readFile(join(dist, path.slice(base.length), 'index.html'), 'utf8');
  for (const file of await staticScripts(html)) {
    const code = await readFile(file, 'utf8');
    if (/WebGLRenderer|three\.module/.test(code)) {
      threeUpFront = true;
      fail(`three.js is in the initial bundle of ${path} (${file.slice(dist.length + 1)})`);
    }
  }
}
console.log(
  threeUpFront
    ? `\n${red('✗')} three.js loads up front`
    : `\n${green('✓')} three.js not in any initial bundle`,
);

// ---------- Lighthouse ----------

console.log('');
const lighthousePages = pages
  .filter((p) => p === base || p.startsWith(`${base}records/`))
  .slice(0, 2);
// The homepage (the crate) runs in both modes, also with a record playing
// (the panel on desktop, the bottom sheet on mobile); liner notes in mobile mode only.
const lighthouseRuns = lighthousePages.flatMap((path) =>
  path === base
    ? [
        [path, 'mobile'],
        [path, 'desktop'],
        [`${path}?record=baur`, 'mobile'],
        [`${path}?record=baur`, 'desktop'],
      ]
    : [[path, 'mobile']],
);
if (process.env.VERIFY_SKIP_LIGHTHOUSE) {
  console.log(dim('Lighthouse skipped (VERIFY_SKIP_LIGHTHOUSE).'));
  lighthouseRuns.length = 0;
}
for (const [path, mode] of lighthouseRuns) {
  const result = await lighthouse(
    origin + path,
    {
      port: CDP_PORT,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility', 'performance', 'best-practices', 'seo'],
    },
    mode === 'desktop' ? desktopConfig : undefined,
  );
  const cats = Object.values(result?.lhr.categories ?? {});
  const scores = cats.map((c) => {
    const score = Math.round((c.score ?? 0) * 100);
    const text = `${c.id} ${score}`;
    return score === 100 ? green(text) : score >= 90 ? yellow(text) : red(text);
  });
  console.log(`Lighthouse ${mode.padEnd(7)} ${path}: ${scores.join(' · ')}`);
  const a11y = result?.lhr.categories.accessibility?.score ?? 0;
  if (a11y < 1) {
    fail(`Lighthouse accessibility ${Math.round(a11y * 100)} on ${path} (${mode})`);
    for (const audit of Object.values(result.lhr.audits)) {
      if (
        audit.score === 0 &&
        result.lhr.categories.accessibility.auditRefs.some((r) => r.id === audit.id)
      ) {
        console.log(`    ${audit.id}: ${audit.title}`);
      }
    }
  }
}

await browser.close();
server.close();

// ---------- summary ----------

if (failures.length) {
  console.log(red(`\n✗ ${failures.length} problem(s) found.`));
  process.exit(1);
}
console.log(green('\n✓ All checks passed.'));
