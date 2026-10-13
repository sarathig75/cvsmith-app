import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { saveCv } from '../../services/cvService';
import type { ParsePart } from '../../types';
import type { CvDraft } from '../../types/cvDraft';

export const AUTOSAVE_DELAY_MS = 2000;
export const RETRY_DELAY_MS = 5000;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Saves the canvas about 2 s after the last change (PATCH /api/cv). Starts only once `enabled`
 * (the saved CV has been loaded), so an empty canvas can never overwrite a saved one. Only one
 * save runs at a time; changes made meanwhile are saved right after. Failed saves are retried.
 * `userEdited` is set by the canvas on user input and reported once per save as `edited`.
 */
export function useAutosave(
  enabled: boolean,
  draft: CvDraft,
  appliedParts: ParsePart[],
  userEdited: MutableRefObject<boolean>,
): { state: SaveState; markSaved: (draft: CvDraft, appliedParts: ParsePart[]) => void } {
  const [state, setState] = useState<SaveState>('idle');
  const latest = useRef({ draft, appliedParts });
  latest.current = { draft, appliedParts };
  const lastSaved = useRef<string | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const serialize = () => JSON.stringify({ d: latest.current.draft, a: latest.current.appliedParts });

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    const snapshot = serialize();
    if (snapshot === lastSaved.current) return;
    if (inFlight.current) {
      timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
      return;
    }
    inFlight.current = true;
    const edited = userEdited.current;
    userEdited.current = false;
    setState('saving');
    try {
      const { draft: d, appliedParts: a } = latest.current;
      await saveCv({ content: d as unknown as Record<string, unknown>, applied_parts: a, edited });
      lastSaved.current = snapshot;
      setState('saved');
      // Changes made while this save was running are picked up by the next one.
      if (serialize() !== snapshot) timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
    } catch {
      userEdited.current = userEdited.current || edited;
      setState('error');
      timer.current = setTimeout(save, RETRY_DELAY_MS);
    } finally {
      inFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled || lastSaved.current === null || serialize() === lastSaved.current) return;
    setState((st) => (st === 'error' ? st : 'saving')); // unsaved changes show as "Saving…" right away
    clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, draft, appliedParts, save]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Unsaved changes: ask before the tab is closed or reloaded.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (enabled && serialize() !== lastSaved.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // The canvas as loaded from the server counts as saved; anything merged after it is saved.
  const markSaved = useCallback((d: CvDraft, a: ParsePart[]) => {
    lastSaved.current = JSON.stringify({ d, a });
  }, []);

  return { state, markSaved };
}
