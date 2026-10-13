import type { OtherKind } from '../types/cvDraft';

/** How one kind of "Others" item is labelled and which fields it shows. */
export type OtherKindSpec = {
  /** Name in the type picker and heading in the preview. */
  label: string;
  /** Name of one item on the canvas, e.g. "Language 2". */
  item: string;
  title: string;
  detail?: string;
  dates: 'none' | 'single' | 'range';
  description: boolean;
};

/** In display order. A new kind of item only needs a line here (and in OtherKind). */
export const OTHER_KINDS: Record<OtherKind, OtherKindSpec> = {
  language: { label: 'Languages', item: 'Language', title: 'Language', detail: 'Proficiency', dates: 'none', description: false },
  award: { label: 'Awards', item: 'Award', title: 'Award', detail: 'Awarded by', dates: 'single', description: true },
  volunteer: { label: 'Volunteering & Leadership', item: 'Volunteering', title: 'Role', detail: 'Organisation', dates: 'range', description: true },
  interest: { label: 'Interests', item: 'Interest', title: 'Interest', detail: 'Details', dates: 'none', description: false },
  custom: { label: 'Custom section', item: 'Custom item', title: 'Title', detail: 'Organisation / detail', dates: 'single', description: true },
};

export const OTHER_KIND_ORDER = Object.keys(OTHER_KINDS) as OtherKind[];

export const isOtherKind = (k: string): k is OtherKind => k in OTHER_KINDS;
