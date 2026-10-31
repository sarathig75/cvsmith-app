import type { CvDraft, Entry } from '../types/cvDraft';

type DateField = { section: 'experience' | 'projects' | 'education' | 'certifications' | 'others'; keys: string[] };
const DATE_FIELDS: DateField[] = [
  { section: 'experience', keys: ['start', 'end'] },
  { section: 'projects', keys: ['start', 'end'] },
  { section: 'education', keys: ['start', 'end'] },
  { section: 'certifications', keys: ['date'] },
  { section: 'others', keys: ['start', 'end'] },
];
const MONTH_YEAR = /^(\d{4})-\d{2}$/;

/** Earlier values of the entries that were changed, to put back: section, entry id, the old field values. */
export type DateUndo = { section: DateField['section']; id: string; before: Record<string, string> }[];

/**
 * Shows every date as the year only: "2019-03" becomes "2019" and the entry's "Years only" box is ticked. A month
 * cannot be added where the CV never gave one, so one format for all means the year. Returns the new draft, what to
 * put back to undo it, and whether anything changed.
 */
export function yearOnlyDates(draft: CvDraft): { draft: CvDraft; undo: DateUndo; changed: boolean } {
  const undo: DateUndo = [];
  const next = { ...draft };
  for (const { section, keys } of DATE_FIELDS) {
    next[section] = draft[section].map((e: Entry) => {
      const has = keys.some((k) => (e[k] ?? '') !== '');
      if (!has) return e;
      const before: Record<string, string> = { yearOnly: e.yearOnly ?? '' };
      const updated: Entry = { ...e, yearOnly: 'true' };
      let touched = (e.yearOnly ?? '') !== 'true';
      for (const k of keys) {
        before[k] = e[k] ?? '';
        const m = MONTH_YEAR.exec(e[k] ?? '');
        if (m) {
          updated[k] = m[1];
          touched = true;
        }
      }
      if (!touched) return e;
      undo.push({ section, id: e.id, before });
      return updated;
    });
  }
  return { draft: next, undo, changed: undo.length > 0 };
}

/** Puts the dates back, entry by entry (an entry deleted since is skipped; other edits are kept). */
export function undoDates(draft: CvDraft, undo: DateUndo): CvDraft {
  const next = { ...draft };
  for (const { section, id, before } of undo) {
    next[section] = next[section].map((e: Entry) => (e.id === id ? { ...e, ...before } : e));
  }
  return next;
}
