import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #1E4D4F');

export const SECTIONS = ['projects', 'experience', 'community', 'honors'] as const;

/** Catalogue prefix per section: projects DCL-1xx, experience DCL-2xx, and so on. */
const CATALOGUE_PREFIX = { projects: 1, experience: 2, community: 3, honors: 4 } as const;

const image = z.object({
  /** Path under public/ (e.g. "records/power-smart/screens.webp") or a placeholder. */
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

/** A flow diagram drawn in HTML/CSS: each step is a box, read left to right. */
const diagram = z.object({
  steps: z.array(z.string()).min(2),
  caption: z.string().optional(),
});

/**
 * One Markdown file per record in src/content/records/, named "<catalogue number>-<slug>.md".
 * Frontmatter holds the structured data; the body is liner-notes prose (full records)
 * or a 1–3 sentence description (card records).
 * Unknown facts are left out (Darren, Oct 2026): optional fields are omitted and the
 * page hides the row. Never write a guess in their place.
 */
const records = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/records' }),
  schema: z
    .object({
      /** Crate section; each gets a divider card and a group in the plain list. */
      section: z.enum(SECTIONS),
      /** full = liner-notes page; card = short card in the list, no page. */
      depth: z.enum(['full', 'card']),
      /** Catalogue number shown on the sleeve, e.g. "DCL-101". */
      catalogue: z.string().regex(/^DCL-[1-4]\d\d$/, 'Use DCL-1xx … DCL-4xx'),
      /** Position within its section (crate and plain list). */
      order: z.number().int(),
      title: z.string(),
      /** 12in = full LP sleeve; 7in = smaller single. */
      format: z.enum(['12in', '7in']),
      /** One line for the sleeve's Now Playing panel and the plain list. */
      tagline: z.string(),
      role: z.string(),
      team: z.string().optional(),
      org: z.string().optional(),
      dates: z.string().optional(),
      location: z.string().optional(),
      platform: z.string().optional(),
      links: z
        .array(
          z.object({
            label: z.string(),
            /** Full URL, or a placeholder until it's known. */
            href: z.string(),
            kind: z.enum([
              'repo',
              'demo',
              'video',
              'prototype',
              'certificate',
              'case-study',
              'other',
            ]),
          }),
        )
        .optional(),
      /**
       * What the Now Playing panel shows (and the top of the liner notes). See
       * src/components/NowPlaying/Stage.astro. A video without a src shows a calm
       * "Demo recording coming soon" poster, never a raw placeholder.
       */
      stage: z.object({
        kind: z.enum([
          'video',
          'youtube',
          'gallery',
          'diagram',
          'chart',
          'photo',
          'certificate',
          'none',
        ]),
        /** Path under public/ (e.g. "records/baur/demo.mp4") or an external URL. */
        src: z.string().optional(),
        /** Device frame for video and app-screen galleries. */
        device: z.enum(['phone', 'tablet']).optional(),
        orientation: z.enum(['portrait', 'landscape']).optional(),
        poster: z.string().optional(),
        youtubeId: z.string().optional(),
        images: z.array(image).optional(),
        /** For kind "diagram" without a src: the flow, drawn in HTML/CSS. */
        steps: diagram.shape.steps.optional(),
        caption: z.string().optional(),
        /** For kind "chart": labelled bars drawn in HTML/CSS. */
        chart: z
          .object({
            title: z.string(),
            metric: z.string(),
            series: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
            note: z.string().optional(),
          })
          .optional(),
        alt: z.string(),
      }),
      cover: z.object({
        ground: hexColor,
        ink: hexColor,
        accents: z.array(hexColor).default([]),
        motif: z.enum(['rings', 'documents', 'lens', 'waveform', 'graph', 'grid', 'steps', 'type']),
        /** Small caps line printed at the bottom of the sleeve. */
        caption: z.string().optional(),
      }),
      /** Drafts are excluded from every page and list. */
      draft: z.boolean().optional(),

      // Required when depth is "full" (liner notes); see superRefine below.
      summary: z
        .object({ problem: z.string(), role: z.string(), result: z.string().optional() })
        .optional(),
      stack: z.array(z.string()).optional(),
      /** Optional: tools the rest of the team used, kept apart from Darren's `stack`. */
      teamStack: z.array(z.string()).optional(),
      credits: z.object({ darren: z.array(z.string()), team: z.array(z.string()) }).optional(),
      /** 1–3 "session notes": key decisions. `rejected` is left out when there was no alternative. */
      decisions: z
        .array(
          z.object({
            topic: z.string(),
            chose: z.string(),
            rejected: z.string().optional(),
            why: z.string().optional(),
          }),
        )
        .min(1)
        .max(3)
        .optional(),
      /** Ideas that were cut. Optional: without them the liner notes skip the B-sides track. */
      bsides: z.array(z.object({ idea: z.string(), whyCut: z.string() })).optional(),
      learned: z.string().optional(),
      /** Extra stills or diagrams for the liner notes' "From the session" (after the stage's). */
      session: z.array(z.union([image, diagram])).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.depth === 'full') {
        for (const key of ['summary', 'credits', 'decisions', 'stack'] as const) {
          if (data[key] === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: [key],
              message: `"${key}" is required for full-depth records`,
            });
          }
        }
      }
      const prefix = CATALOGUE_PREFIX[data.section];
      if (!data.catalogue.startsWith(`DCL-${prefix}`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['catalogue'],
          message: `${data.section} records use DCL-${prefix}xx`,
        });
      }
      const { kind, youtubeId, images, src, steps, chart } = data.stage;
      if (kind === 'chart' && !chart && !src) {
        ctx.addIssue({
          code: 'custom',
          path: ['stage', 'chart'],
          message: 'chart stages need a chart (or a src)',
        });
      }
      if (kind === 'diagram' && !src && !steps) {
        ctx.addIssue({
          code: 'custom',
          path: ['stage', 'steps'],
          message: 'diagram stages need a src or steps',
        });
      }
      if (kind === 'youtube' && !youtubeId) {
        ctx.addIssue({
          code: 'custom',
          path: ['stage', 'youtubeId'],
          message: 'youtube stages need a youtubeId',
        });
      }
      if (kind === 'gallery' && !images?.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['stage', 'images'],
          message: 'gallery stages need images',
        });
      }
    }),
});

export const collections = { records };
