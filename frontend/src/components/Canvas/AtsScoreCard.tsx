import { useCallback, useEffect, useRef, useState } from 'react';
import { getAtsScores } from '../../services/dashboardService';
import type { AtsPair, AtsScore } from '../../types';

/** How long after the last saved edit the score is worked out again. */
export const RESCORE_DELAY_MS = 1500;

/**
 * The ATS format score of the uploaded file (before) next to the saved CV (after), with every check.
 * `savedCount` goes up each time the canvas finishes saving: the score is then worked out again a moment
 * later, so it follows the user's edits. `flush` saves pending edits first when "Check again" is clicked.
 */
export function AtsScoreCard({
  ready,
  flush,
  savedCount = 0,
}: {
  ready: boolean;
  flush?: () => Promise<unknown>;
  savedCount?: number;
}) {
  const [pair, setPair] = useState<AtsPair | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [showChecks, setShowChecks] = useState(false);
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
  const before = num(pair?.before);
  const after = num(pair?.after);
  if (!ready) return null;
  const checks = Array.isArray(pair?.after?.checks) ? pair.after.checks : [];
  const fix = pair?.after?.first_fix;
  return (
    <section aria-label="ATS format score" className="mb-6 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h2 className="text-sm font-semibold">ATS format score</h2>
        {before !== null && (
          <span className="text-sm text-slate-700">
            Before: <strong data-testid="ats-before">{before}</strong>
          </span>
        )}
        <span className="text-sm text-slate-700">
          {before !== null ? 'After' : 'Now'}:{' '}
          <strong data-testid="ats-after">{state === 'loading' && after === null ? '…' : (after ?? '–')}</strong>
        </span>
        <button
          type="button"
          onClick={checkAgain}
          disabled={state === 'loading'}
          className="text-sm font-medium text-brand hover:underline disabled:opacity-40"
        >
          {state === 'loading' ? 'Checking…' : 'Check again'}
        </button>
        {checks.length > 0 && (
          <button
            type="button"
            onClick={() => setShowChecks(!showChecks)}
            aria-expanded={showChecks}
            className="text-sm font-medium text-brand hover:underline"
          >
            {showChecks ? 'Hide the checks' : 'See the checks ›'}
          </button>
        )}
      </div>
      {fix && <p className="mt-2 text-sm text-slate-800">First fix: {fix.text} (+{fix.points})</p>}
      {showChecks && checks.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label="ATS checks">
          {checks.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline gap-3">
                <span
                  className={`w-14 shrink-0 font-medium ${c.passed ? 'text-success-text' : 'text-warning-text'}`}
                  aria-label={`${c.points} of ${c.max} points`}
                >
                  {c.points}/{c.max}
                </span>
                <span className="text-slate-800">{c.label}</span>
              </div>
              {c.fix && <p className="ml-[68px] text-xs text-slate-600">{c.fix}</p>}
            </li>
          ))}
        </ul>
      )}
      {state === 'failed' && (
        <p role="status" className="mt-2 text-sm text-warning-text">
          We couldn't work out your score just now. Try again in a moment.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-600">
        How well your CV is written for applicant tracking systems. It is our own checklist, not a promise about any employer's system.
        Checks that do not apply to your file are left out.
      </p>
    </section>
  );
}
