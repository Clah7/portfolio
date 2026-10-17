/**
 * Site-wide facts. Unknown values are left out (null), and the page skips them.
 */
export const site = {
  name: 'Darren Christian Liharja',
  shortName: 'Darren C. Liharja',
  role: 'Product-minded iOS engineer',
  availability: 'Open to product management and iOS engineering roles.',
  description:
    'Darren Christian Liharja, a product-minded iOS engineer open to product management and iOS engineering roles. Pick a record to see the work.',
  boxLabel: { line1: 'Darren — Selected Work', line2: '2023–2026' },
  /** Path under public/. */
  photo: { src: 'about/darren.webp', alt: 'Darren Christian Liharja', width: 700, height: 860 },
  about:
    'Informatics Engineering final-year student at Universitas Padjadjaran (GPA 3.88/4.00) and learner at Apple Developer Academy in Batam.',
  offTheRecord:
    'Listens to R&B, soul and orchestral music on IEMs; training for a sub-2:30 half marathon; plays badminton.',
  contact: {
    email: 'darrenliharja@gmail.com',
    linkedin: 'https://linkedin.com/in/darren-christian-liharja',
    github: 'https://github.com/Clah7',
  },
  /** Site-relative path (e.g. "resume.pdf" in public/) or a full URL; null hides the button. */
  resume: null as string | null,
  /** Site-relative path to a 1200×630 image in public/, or a full URL; null leaves og:image out. */
  ogImage: null as string | null,
} as const;
