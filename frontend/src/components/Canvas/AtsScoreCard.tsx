import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getAtsScores } from '../../services/dashboardService';
import type { AtsCheck, AtsPair, AtsScore } from '../../types';
import { ScoreGroups } from '../Common/ScoreGroups';
import { ScoreRing } from '../Common/ScoreRing';
import { Button } from '../Common/Button';

/** How long after the last saved edit the score is worked out again. */
export const RESCORE_DELAY_MS = 1500;

/** fix_kind values the Canvas fixes by itself (docs/API_CONTRACT.md, "ATS score panel"). */
export const AUTOMATIC_FIXES = ['dates_format'];

/**
 * The ATS score panel on the Canvas: a ring with the score, "Fix all" (automatic fixes) and the Improve all slot,
 * then one bar per group of checks. `savedCount` goes up each time the canvas finishes saving: the score is then
 * worked out again a moment later, so it follows the user's edits. `flush` saves pending edits first when "Check
 * again" is clicked. `renderFix` gives the button for a failing check; `onFixAll` applies the automatic fixes.
 */
export function AtsScoreCard({
  ready,
  flush,
  savedCount = 0,
  improveSlot,
  renderFix,
  onFixAll,
  notice,
}: {
  ready: boolean;
  flush?: () => Promise<unknown>;
  savedCount?: number;
  /** The "Improve all" button (Pro). */
  improveSlot?: ReactNode;
  renderFix?: (check: AtsCheck) => ReactNode;
  onFixAll?: () => void;
  /** A message under the buttons (what "Fix all" did, with its Undo). */
  notice?: ReactNode;
}) {
  const [pair, setPair] = useState<AtsPair | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  // A slow answer to an older request never replaces a newer one.
  const latest = useRef(0);
  const load = useCallback(() => {
    const mine = ++latest.current;
    setState('loading');
    getAtsScores().then(
      (p) => {
        if (mine !== latest.current) return;
        setPair(p);
        setState('idle');
      },
      () => {
        if (mine === latest.current) setState('failed');
      },
    );
  }, []);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Work the score out again after the canvas has been saved (savedCount stays 0 until the first save).
  useEffect(() => {
    if (!ready || savedCount === 0) return;
    const t = setTimeout(load, RESCORE_DELAY_MS);
    return () => clearTimeout(t);
  }, [savedCount, ready, load]);

  const checkAgain = async () => {
    await flush?.();
    load();
  };

  const num = (s: AtsScore | null | undefined) => (typeof s?.score === 'number' ? s.score : null);
  if (!ready) return null;
  const after = pair?.after && typeof pair.after.score === 'number' ? pair.after : null;
  const before = num(pair?.before);
  const checks = Array.isArray(after?.checks) ? after.checks : [];
  const canFixAll = !!onFixAll && checks.some((c) => c.fix && c.fix_kind && AUTOMATIC_FIXES.includes(c.fix_kind));
  return (
    <section aria-label="ATS score" className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 md:p-6">
      <h2 className="text-center text-xl font-semibold">ATS score</h2>
      {after ? (
        <ScoreRing score={after.score} testId="ats-after" label="ATS score" />
      ) : (
        <div className="py-12 text-center text-slate-500" data-testid="ats-after">
          {state === 'loading' ? '…' : '–'}
        </div>
      )}
      {before !== null && after && (
        <p className="text-center text-sm text-slate-600">
          Before your edits: <strong data-testid="ats-before">{before}</strong>
        </p>
      )}
      {(canFixAll || improveSlot) && (
        <div className="flex flex-col gap-2">
          {canFixAll && (
            <Button variant="secondary" onClick={onFixAll} fullWidth>
              Fix all
            </Button>
          )}
          {improveSlot}
        </div>
      )}
      {notice}
      {after && <ScoreGroups score={after} renderFix={renderFix} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={checkAgain}
          disabled={state === 'loading'}
          className="text-sm font-medium text-brand hover:underline disabled:opacity-40"
        >
          {state === 'loading' ? 'Checking…' : 'Check again'}
        </button>
      </div>
      {state === 'failed' && (
        <p role="status" className="text-sm text-warning-text">
          We couldn&apos;t work out your score just now. Try again in a moment.
        </p>
      )}
      <p className="text-xs leading-relaxed text-slate-600">
        How well your CV is written for applicant tracking systems. It is our own checklist, not a promise about any employer&apos;s
        system. Checks that do not apply to your file are left out.
      </p>
    </section>
  );
}
