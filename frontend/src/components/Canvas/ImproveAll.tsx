import { useRef, useState } from 'react';
import { parseApiError } from '../../services/api';
import { decideSuggestion, requestSuggestion } from '../../services/suggestionService';
import type { Quota, SuggestionRequest } from '../../types';
import type { CvDraft } from '../../types/cvDraft';
import { improveTargets } from '../../utils/improveTargets';
import type { ImproveTarget } from '../../utils/improveTargets';
import { Button } from '../Common/Button';
import { Modal } from '../Common/Modal';
import { Spinner } from '../Common/Spinner';

type Outcome =
  | { target: ImproveTarget; kind: 'applied'; id: string; oldText: string }
  | { target: ImproveTarget; kind: 'unchanged' }
  | { target: ImproveTarget; kind: 'needs_detail'; names: string[] }
  | { target: ImproveTarget; kind: 'failed'; message: string }
  | { target: ImproveTarget; kind: 'skipped'; message: string };

type Phase = 'closed' | 'confirm' | 'running' | 'done' | 'undone';

type Props = {
  draft: CvDraft;
  quota: Quota | null;
  /** Saves the canvas now, so the summary and headline are written from the improved descriptions. */
  flush: () => Promise<boolean>;
  /** Puts a suggestion's text into the canvas (as when the user accepts it). */
  apply: (request: SuggestionRequest, text: string, suggestionId: string) => void;
  /** Puts the earlier text back. */
  restore: (request: SuggestionRequest, oldText: string, suggestionId: string) => void;
  /** Called after each request, so the quota shown on the canvas is refreshed. */
  onUsed: () => void;
  disabled?: boolean;
};

/**
 * Pro: "Improve all" asks a suggestion for every field that has text, applies each one that changes it, and
 * lists what happened, with "Undo all". The user confirms first, with the number of suggestions it may use.
 */
export function ImproveAll({ draft, quota, flush, apply, restore, onUsed, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>('closed');
  const [targets, setTargets] = useState<ImproveTarget[]>([]);
  const [current, setCurrent] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const cancelled = useRef(false);

  const open = () => {
    setTargets(improveTargets(draft));
    setOutcomes([]);
    setPhase('confirm');
  };
  const close = () => setPhase('closed');

  const run = async () => {
    cancelled.current = false;
    setPhase('running');
    const done: Outcome[] = [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setCurrent(i);
      if (cancelled.current) {
        done.push({ target, kind: 'skipped', message: 'Stopped before this one.' });
        continue;
      }
      // The summary and headline are written from the saved CV: save the improved descriptions first.
      if (target.request.field === 'summary' || target.request.field === 'headline') await flush();
      try {
        const s = await requestSuggestion(target.request);
        if (!s.changed) {
          done.push({ target, kind: 'unchanged' });
        } else if (s.missing_details && s.missing_details.length > 0) {
          // Names the CV does not contain are not applied automatically: the user can review it one at a time.
          done.push({ target, kind: 'needs_detail', names: s.missing_details });
        } else {
          apply(target.request, s.suggested, s.id);
          decideSuggestion(s.id, 'accepted').catch(() => undefined);
          done.push({ target, kind: 'applied', id: s.id, oldText: target.request.text });
        }
      } catch (err) {
        const e = parseApiError(err);
        if (e.code === 'QUOTA_EXCEEDED') {
          // Out of suggestions: this and every later field is not done.
          done.push({ target, kind: 'skipped', message: e.message });
          for (const rest of targets.slice(i + 1)) done.push({ target: rest, kind: 'skipped', message: e.message });
          onUsed();
          break;
        }
        done.push({ target, kind: 'failed', message: e.message });
      }
      onUsed();
    }
    setOutcomes(done);
    setPhase('done');
  };

  const undo = () => {
    for (const o of [...outcomes].reverse()) {
      if (o.kind !== 'applied') continue;
      restore(o.target.request, o.oldText, o.id);
      decideSuggestion(o.id, 'declined').catch(() => undefined);
    }
    setPhase('undone');
  };

  const applied = outcomes.filter((o) => o.kind === 'applied');
  const count = (kind: Outcome['kind']) => outcomes.filter((o) => o.kind === kind).length;
  const remaining = quota?.remaining;
  const tooMany = remaining !== undefined && targets.length > remaining;

  return (
    <>
      <Button
        variant="secondary"
        onClick={open}
        disabled={disabled}
        title="Ask for a suggestion for every field and apply them (Pro)"
      >
        <span aria-hidden="true">💡</span> Improve all
      </Button>
      {phase !== 'closed' && (
        <Modal
          title="Improve all"
          size="lg"
          // While suggestions are being written, closing means "stop after this one".
          onClose={() => (phase === 'running' ? (cancelled.current = true) : close())}
        >
          {phase === 'confirm' && (
            <div className="mt-2 flex flex-col gap-4 text-sm text-slate-700">
              {targets.length === 0 ? (
                <p>There is nothing to improve yet. Add your work experience or a summary first.</p>
              ) : (
                <>
                  <p>
                    This asks for up to <strong>{targets.length}</strong> suggestion{targets.length === 1 ? '' : 's'}: your headline,
                    summary and every job and project description that has text.
                    {remaining !== undefined && (
                      <>
                        {' '}
                        You have <strong>{remaining}</strong> of {quota?.limit} left this month. Only suggestions that change your text
                        count.
                      </>
                    )}
                  </p>
                  {tooMany && (
                    <p role="note" className="rounded-sm bg-warning-bg p-3 text-warning-text">
                      You may run out part-way. It stops when your suggestions run out and tells you what was not done.
                    </p>
                  )}
                  <p>
                    Each improvement is applied to your CV straight away, so you can see them on the Canvas. You can undo them all
                    afterwards. A suggestion that mentions something not in your CV is not applied; you can review it on its own.
                  </p>
                  <p className="text-slate-600">It takes about 10 to 20 seconds per field.</p>
                </>
              )}
              <div className="flex flex-wrap gap-3">
                {targets.length > 0 && <Button onClick={run}>Start</Button>}
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {phase === 'running' && (
            <div className="mt-2 flex flex-col gap-4">
              <p role="status" className="flex items-center gap-2 text-slate-700">
                <Spinner className="h-5 w-5" label="" />
                Improving {current + 1} of {targets.length}: {targets[current]?.label}
              </p>
              <Button variant="secondary" className="self-start" onClick={() => (cancelled.current = true)}>
                Stop after this one
              </Button>
            </div>
          )}
          {phase === 'done' && (
            <div className="mt-2 flex flex-col gap-4 text-sm text-slate-700">
              <p role="status">
                <strong>{applied.length}</strong> improvement{applied.length === 1 ? '' : 's'} applied
                {count('unchanged') > 0 && <>, {count('unchanged')} already in good shape</>}
                {count('needs_detail') > 0 && <>, {count('needs_detail')} need a detail from you</>}
                {count('failed') + count('skipped') > 0 && <>, {count('failed') + count('skipped')} not done</>}.
              </p>
              <ul className="flex flex-col gap-1.5" aria-label="What happened">
                {outcomes.map((o, i) => (
                  <li key={i}>
                    <span className="font-medium">{o.target.label}:</span>{' '}
                    {o.kind === 'applied' && 'applied.'}
                    {o.kind === 'unchanged' && 'already in good shape (not counted).'}
                    {o.kind === 'needs_detail' &&
                      `not applied: it mentions ${o.names.join(', ')}, which is not in your CV. Add it, then use 💡 on this field.`}
                    {o.kind === 'failed' && `not done: ${o.message}`}
                    {o.kind === 'skipped' && `not done: ${o.message}`}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button onClick={close}>Done</Button>
                {applied.length > 0 && (
                  <Button variant="secondary" onClick={undo}>
                    Undo all
                  </Button>
                )}
              </div>
            </div>
          )}
          {phase === 'undone' && (
            <div className="mt-2 flex flex-col gap-4 text-sm text-slate-700">
              <p role="status">Your earlier text is back on every field.</p>
              <Button className="self-start" onClick={close}>
                Done
              </Button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
