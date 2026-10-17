# Crate Digging

The portfolio of **Darren Christian Liharja**, a product-minded iOS engineer.

The homepage is an open cardboard box of vinyl records. Each record is a project: pull one out and it plays on a turntable, with a "Now Playing" panel showing the app demo and a link to the full case study (the "liner notes").

Built with [Astro](https://astro.build) (static output) and TypeScript, styled with plain CSS custom properties, and deployed to GitHub Pages.

## Run it locally

Requires Node 22.22 or newer (`.nvmrc` pins 24).

```sh
npm install
npm run dev       # http://localhost:4321/portfolio/
```

| Script            | What it does                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                                                                                                                            |
| `npm run build`   | Production build into `dist/`                                                                                                                         |
| `npm run preview` | Serve the built site (Astro 7 runs it in the background; stop with `npx astro preview stop`)                                                          |
| `npm run check`   | Type-check (`astro check`), then list any placeholders left                                                                                           |
| `npm run format`  | Prettier                                                                                                                                              |
| `npm run verify`  | Browser audit of the last build: axe, Lighthouse, 44px targets, self-hosted fonts, no three.js up front. First run: `npx playwright install chromium` |

The site is served under `/portfolio/` locally too, so it behaves exactly like the GitHub Pages deploy.

## Add or edit a record

Every record (project, role, community work or honour) is one Markdown file in `src/content/records/`, named after its catalogue number and slug.

1. Copy a file from the same section, e.g. `src/content/records/103-power-smart.md` → `108-new-project.md`. The number only sorts the files; the URL becomes `/records/new-project/`.
2. Fill in the frontmatter. The schema lives in `src/content.config.ts` and the build fails with a clear message if a field is missing or mistyped. Key fields:
   - `section`: `projects`, `experience`, `community` or `honors` (one divider in the crate each)
   - `catalogue` with the section's prefix (projects `DCL-1xx`, experience `DCL-2xx`, community `DCL-3xx`, honors `DCL-4xx`) and `order` (position within the section)
   - `depth`: `full` gets a liner-notes page (and needs `summary`, `credits`, `decisions`, `learned`, `stack`; `bsides` are optional); `card` is a short entry in the plain list with no page
   - `format`: `12in` for a full sleeve, `7in` for a single
   - `cover`: `ground`, `ink`, `accents` (hex colours) and a `motif` used to draw the sleeve art
   - `stage`: what the Now Playing panel shows (`video`, `youtube`, `gallery`, `photo`, `certificate`, `diagram`, `chart` or `none`). Videos and app-screen galleries take `device: phone | tablet` (+ `orientation`); diagrams take `steps`; charts take `chart: { title, metric, series, note }`. A video without a `src` shows a "Demo recording coming soon" poster.
   - `links`: optional `{ label, href, kind }` list (view-only and prototype links only)
   - `credits.darren` vs `credits.team`: keep team work in the team column (likewise `stack` vs the optional `teamStack`)
   - `draft: true` hides a record everywhere
3. Write the body: liner-notes prose for `full` records (it appears under "The problem"), 1–3 sentences for `card` records. Internal links are root-relative, e.g. `[Baur](/records/baur/)`.
4. Put media in `public/records/<slug>/` as WebP or video and reference it in frontmatter as `records/<slug>/file.webp`. Black out ID numbers on certificates before adding them.

Name, about text and photo, contact links, the resume link, the box label and the OG image live in `src/data/site.ts`. Source PDFs go in `docs/source/`, which is gitignored.

### Missing facts

Never invent facts, numbers or quotes. When something is unknown, leave it out: omit the field (dates, result, what I learned, a decision's reason, B-sides…) and the page hides that row or section.

While drafting you can still write a placeholder, capital letters in square brackets in quotes (e.g. `'[ROLE]'`); it shows on the page as a highlighted chip. Don't publish them. To list any that are left:

```sh
npm run check
```

This only warns; it never fails the build.

### Media rules

- Demo videos: H.264 MP4 plus a WebM (or AV1) alternative, about 720p, muted, ideally **under 8 MB each**, with a WebP poster.
- Git rejects files over 100 MB, and GitHub Pages caps the whole published site at 1 GB.
- If videos get big, host them on Cloudflare R2 or Bunny Stream and put only the URL in frontmatter.

## Deploy

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml` (`withastro/action` builds, `actions/deploy-pages` publishes). It can also be run by hand from the Actions tab.

**One-time setup:** in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

`astro.config.mjs` works out `site` and `base` from the repo name:

- repo `Clah7.github.io` → served at `https://clah7.github.io/`
- any other repo (this one is `portfolio`) → served at `https://clah7.github.io/portfolio/`

All internal links go through `url()` in `src/lib/url.ts` (built on `import.meta.env.BASE_URL`), so both cases work. `BASE_PATH` and `SITE_URL` env vars override the defaults.

### Custom domain (later)

1. Add `public/CNAME` containing the domain, e.g. `darren.example`.
2. At the DNS provider: for an apex domain, add `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (and the matching `AAAA` records); for a subdomain, add a `CNAME` to `clah7.github.io`.
3. In **Settings → Pages**, enter the domain and tick **Enforce HTTPS** once the certificate is issued.
4. Serve from the root: in `deploy.yml`, set `env: { BASE_PATH: /, SITE_URL: https://darren.example }` on the build step.

### Hosting alternatives

The site is fully static, so switching hosts means changing the build target and `base`, nothing else.

| Host                                         | Why pick it                                                                                                                        | Watch out for                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **GitHub Pages** (current)                   | Free, lives next to the code, simple Actions deploy, recruiters see the repo                                                       | 1 GB site cap, ~100 GB/month soft bandwidth, no per-route headers or redirects, not for commercial use |
| **Cloudflare Pages / Workers static assets** | Unmetered static bandwidth on the free plan, fast CDN (good for Indonesia and the region), preview URLs per branch, custom headers | 25 MiB per-file limit (fine if videos are compressed), 500 builds/month on the free plan               |
| **Netlify**                                  | Easiest preview deploys, form handling if a contact form is ever added                                                             | Free tier now meters usage; check current limits                                                       |
| **Vercel**                                   | Great previews and analytics                                                                                                       | The Hobby plan is for non-commercial use (a personal portfolio is fine)                                |

## The turntable

On desktop, playing a record runs a real-time three.js scene: the sleeve flies from the crate to the deck, the record drops onto the platter, the tonearm cues to the lead-in groove and the record spins up (33⅓ rpm for 12", 45 rpm for 7"). It's built from code, not models (`src/components/Turntable/three/`), and three.js is only ever loaded with a dynamic `import()`, prefetched when you first hover or focus the crate. Everywhere else, and on any WebGL problem, the CSS turntable (`CssTurntable.astro`) is used instead. To see the fallbacks: narrow the window below 900px, turn on "Reduce motion" in your OS, or launch Chrome with `--disable-webgl`. `npm run verify` tests all of these and saves screenshots of each phase to `docs/screenshots/phase-3/`.

## Project layout

```
src/
  content.config.ts      collection schemas (zod)
  content/records/       one Markdown file per record (four sections)
  data/site.ts           name, role, about, photo, contact, resume, OG image
  components/
    Crate/               the record crate: CSS 3D box, divider tabs
    NowPlaying/          Now Playing panel + mobile sheet, Stage (one per stage kind), Chart
    Turntable/           CssTurntable (the fallback) and the three.js deck (three/, lazy-loaded)
    Sleeve.astro         cover art drawn from frontmatter colours
    Placeholder.astro    renders placeholders as chips
    FontFaces.astro      self-hosted @font-face + preload
  layouts/Base.astro
  lib/                   url(), record helpers, placeholder pattern + Markdown plugin
  pages/index.astro      hero, crate, plain list of all records
  pages/records/[slug].astro   liner notes
  styles/                tokens.css, global.css, fonts.css
public/records/<slug>/   demo videos, posters, stills, certificates
public/about/            About photo
scripts/check-placeholders.mjs
docs/design/             design mockups (reference only)
docs/source/             source PDFs (gitignored)
```

Fonts (Big Shoulders, Schibsted Grotesk and Permanent Marker) come from Fontsource and are self-hosted, Latin subset only. three.js is installed but must only ever be loaded with a dynamic `import()`.

## Roadmap

| Phase | What gets built                                                                                                                       | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | Repo, tokens, fonts, content collections, routes, layout shell, plain-list homepage, deploy pipeline                                  | Done   |
| 1     | CSS 3D crate: the box, sleeves fanned inside, hover tilt and lift, arrow keys between sleeves, Enter to play                          | Done   |
| 1.5   | Crate dividers (Projects, Experience, Community, Honors), 16-record catalogue, `?crate=` deep links                                   | Done   |
| 2     | Now Playing: CSS turntable, stage per record (device frame, gallery, diagram, chart, YouTube facade), summary; bottom sheet on mobile | Done   |
| 3     | three.js turntable (lazy-loaded): record drop, tonearm, 33⅓ rpm spin, reduced-motion and no-WebGL fallbacks                           | Done   |
| 4     | Liner-notes polish, "Also on the record", About, Contact                                                                              |        |
| 5     | Optional vinyl crackle (off by default), performance pass, accessibility audit                                                        |        |
