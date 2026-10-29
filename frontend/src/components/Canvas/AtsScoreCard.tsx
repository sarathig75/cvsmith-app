import { useCallback, useEffect, useState } from 'react';
import { getAtsScores } from '../../services/dashboardService';
import type { AtsPair, AtsScore } from '../../types';

/** The ATS format score of the uploaded file (before) next to the saved CV (after). */
/** `flush` saves pending edits first, so "Check again" scores what the user sees. */
export function AtsScoreCard({ ready, flush }: { ready: boolean; flush?: () => Promise<unknown> }) {
  const [pair, setPair] = useState<AtsPair | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const load = useCallback(() => {
    setState('loading');
    getAtsScores().then(
      (p) => {
        setPair(p);
        setState('idle');
      },
      () => setState('failed'),
    );
  }, []);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);
  const checkAgain = async () => {
    await flush?.();
    load();
  };

  const num = (s: AtsScore | null | undefined) => (typeof s?.score === 'number' ? s.score : null);
  const before = num(pair?.before);
  const after = num(pair?.after);
  if (!ready) return null;
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
      </div>
      {fix && <p className="mt-2 text-sm text-slate-800">First fix: {fix.text} (+{fix.points})</p>}
      {state === 'failed' && (
        <p role="status" className="mt-2 text-sm text-warning-text">
          We couldn't work out your score just now. Try again in a moment.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-600">
        How well your CV is written for applicant tracking systems. It is our own checklist, not a promise about any employer's system.
      </p>
    </section>
  );
}
