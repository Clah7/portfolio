import { getCollection, type CollectionEntry } from 'astro:content';
import { SECTIONS } from '../content.config';
import { isPlaceholder } from './placeholder-pattern.mjs';
import { url } from './url';

export type RecordEntry = CollectionEntry<'records'>;
export type Section = (typeof SECTIONS)[number];

type Data = RecordEntry['data'];
type FullKeys = 'summary' | 'stack' | 'credits' | 'decisions';
/** A record with a liner-notes page: the schema guarantees these fields when depth is "full". */
export type FullRecordEntry = RecordEntry & { data: Data & Required<Pick<Data, FullKeys>> };

export { SECTIONS };

export const SECTION_LABELS: Record<Section, string> = {
  projects: 'Projects',
  experience: 'Experience',
  community: 'Community',
  honors: 'Honors',
};

/** URL slug for a record: the file name without its numeric prefix ("101-baur" → "baur"). */
export function recordSlug(record: RecordEntry): string {
  return record.id.replace(/^\d+-/, '');
}

export function isFull(record: RecordEntry): record is FullRecordEntry {
  return record.data.depth === 'full';
}

/** Id of a record's entry in the plain list on the homepage. */
export function listId(record: RecordEntry): string {
  return `rec-${recordSlug(record)}`;
}

/**
 * Where a record links to without JS: full records open their liner notes;
 * card records jump to their entry in the plain list.
 */
export function recordHref(record: RecordEntry): string {
  return isFull(record) ? url(`/records/${recordSlug(record)}/`) : url(`/#${listId(record)}`);
}

/** Whether a record's stage has anything to show (a video always does: its "coming soon" poster). */
export function hasStage(record: RecordEntry): boolean {
  const { kind, src, images, steps, chart, youtubeId } = record.data.stage;
  const real = (value?: string) => Boolean(value) && !isPlaceholder(value);
  switch (kind) {
    case 'video':
      return true;
    case 'gallery':
      return (images ?? []).some((img) => real(img.src));
    case 'diagram':
      return Boolean(steps) || real(src);
    case 'chart':
      return Boolean(chart);
    case 'youtube':
      return Boolean(youtubeId);
    case 'certificate':
    case 'photo':
      return real(src);
    default:
      return false;
  }
}

/** Site-relative paths (under public/) go through the base; full URLs pass through. */
export function assetUrl(src: string): string {
  return /^https?:\/\//.test(src) ? src : url(src);
}

const bySectionThenOrder = (a: RecordEntry, b: RecordEntry) =>
  SECTIONS.indexOf(a.data.section) - SECTIONS.indexOf(b.data.section) ||
  a.data.order - b.data.order;

/** Published records (drafts excluded), in section order, then by order within each section. */
export async function getRecords(): Promise<RecordEntry[]> {
  const records = await getCollection('records', ({ data }) => !data.draft);
  return records.sort(bySectionThenOrder);
}

/** Published records grouped by section, in section order. */
export async function getSections(): Promise<
  { id: Section; label: string; records: RecordEntry[] }[]
> {
  const records = await getRecords();
  return SECTIONS.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    records: records.filter((r) => r.data.section === id),
  }));
}
