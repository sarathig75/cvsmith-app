import type { ParsePart } from '../types';
import type { CvDraft } from '../types/cvDraft';

/** Edits that were not saved when a session ended; offered back after the next login. */
const KEY = 'cvsmith_unsaved_draft';

export type UnsavedDraft = { userId: string; draft: CvDraft; appliedParts: ParsePart[]; at: string };

export function keepUnsavedDraft(value: UnsavedDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function takeUnsavedDraft(userId: string): UnsavedDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as UnsavedDraft;
    return value.userId === userId ? value : null; // never show one user's edits to another
  } catch {
    return null;
  }
}

export function clearUnsavedDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
