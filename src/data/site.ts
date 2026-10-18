/**
 * Site-wide facts. Keep the wording as Darren gave it; unknown values are left out.
 * The resume is a file, not a field: public/resume.pdf (see src/lib/resume.ts).
 */
export const site = {
  name: 'Darren Christian Liharja',
  shortName: 'Darren C. Liharja',
  role: 'Product-minded iOS engineer',
  availability: 'Open to product management and iOS engineering roles.',
  /** The About section's role line. */
  roleLine: 'Product-minded iOS engineer, open to product management and iOS engineering roles.',
  /** For structured data (schema.org Person). */
  jobTitle: 'iOS Engineer',
  school: 'Universitas Padjadjaran',
  description:
    'Darren Christian Liharja, a product-minded iOS engineer open to product management and iOS engineering roles. Pick a record to see the work.',
  boxLabel: { line1: 'Darren — Selected Work', line2: '2023–2026' },
  /** Path under public/. */
  photo: { src: 'about/darren.webp', alt: 'Darren Christian Liharja', width: 700, height: 860 },
  bio: 'Final-year Informatics Engineering student at Universitas Padjadjaran (GPA 3.88/4.00) and learner at Apple Developer Academy in Batam.',
  contact: {
    email: 'darrenliharja@gmail.com',
    linkedin: 'https://linkedin.com/in/darren-christian-liharja',
    github: 'https://github.com/Clah7',
  },
  /** Link-preview image for pages without their own (path under public/). */
  ogImage: 'og/home.png',
} as const;
