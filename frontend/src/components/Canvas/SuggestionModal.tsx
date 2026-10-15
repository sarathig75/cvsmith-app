import { useCallback, useEffect, useRef, useState } from 'react';
import { parseApiError } from '../../services/api';
import { decideSuggestion, requestSuggestion } from '../../services/suggestionService';
import type { Suggestion, SuggestionRequest } from '../../types';
import { Button } from '../Common/Button';
import { Modal } from '../Common/Modal';
import { UpgradeModal } from '../Common/UpgradeModal';
import { Spinner } from '../Common/Spinner';

export const UPGRADE_MESSAGE =
  "You've used your free suggestion for this month. Upgrade to Pro for 50 suggestions a month ($9.99/month).";

type State =
  | { kind: 'loading' }
  | { kind: 'result'; suggestion: Suggestion }
  | { kind: 'error'; message: string }
  | { kind: 'upgrade'; message: string };

type Props = {
  request: SuggestionRequest;
  /** What is being improved, e.g. "Professional Summary". */
  label: string;
  /** Replaces the field's text in the canvas (then auto-save saves it). */
  onAccept: (text: string) => void;
  /** Called after every finished request, so the quota shown on the canvas is refreshed. */
  onUsed: () => void;
  onClose: () => void;
};

/** One suggestion for one field: current vs suggested text, then use it or keep the original. */
export function SuggestionModal({ request, label, onAccept, onUsed, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const run = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const suggestion = await requestSuggestion(request);
      setState({ kind: 'result', suggestion });
    } catch (err) {
      const e = parseApiError(err);
      // The server's wording for the free plan; Pro users who run out see the same prompt.
      if (e.code === 'QUOTA_EXCEEDED') setState({ kind: 'upgrade', message: e.message || UPGRADE_MESSAGE });
      else setState({ kind: 'error', message: e.message });
    } finally {
      onUsed();
    }
    // The request is fixed for the life of the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exactly one request per opening: React's StrictMode runs effects twice in development,
  // and every request costs an AI call (and may use up the user's suggestion).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  // Recording the decision is for metrics only: a failure must not block the user.
  const decide = (s: Suggestion, status: 'accepted' | 'declined') => decideSuggestion(s.id, status).catch(() => undefined);
  const accept = (s: Suggestion) => {
    onAccept(s.suggested);
    void decide(s, 'accepted');
    onClose();
  };
  const keep = (s: Suggestion) => {
    void decide(s, 'declined');
    onClose();
  };

  if (state.kind === 'upgrade') return <UpgradeModal message={state.message} onClose={onClose} />;

  return (
    <Modal title={`Improve: ${label}`} size="lg" onClose={onClose}>
      {state.kind === 'loading' && (
        <p role="status" className="flex items-center gap-2 py-8 text-slate-600">
          <Spinner className="h-5 w-5" label="" /> Writing a suggestion…
        </p>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="mt-4">
          <p className="mb-4 rounded-sm bg-warning-bg p-3 text-sm text-warning-text">{state.message}</p>
          <div className="flex gap-3">
            <Button onClick={() => void run()}>Try again</Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
      {state.kind === 'result' && !state.suggestion.changed && (
        <div className="mt-4">
          <p className="mb-6 text-slate-700">
            Already in good shape — nothing to change. This did not use one of your suggestions.
          </p>
          <Button onClick={onClose}>OK</Button>
        </div>
      )}
      {state.kind === 'result' && state.suggestion.changed && (
        <div className="mt-4">
          <div className="grid gap-4">
            <TextBox title="Current" text={state.suggestion.original || '(empty)'} />
            <TextBox title="Suggested" text={state.suggestion.suggested} highlight />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => accept(state.suggestion)}>Use suggestion</Button>
            <Button variant="secondary" onClick={() => keep(state.suggestion)}>
              Keep mine
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TextBox({ title, text, highlight }: { title: string; text: string; highlight?: boolean }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1 text-sm font-semibold text-slate-700">{title}</h3>
      <p
        className={`max-h-64 overflow-y-auto whitespace-pre-line rounded-sm border p-3 text-sm ${
          highlight ? 'border-brand/40 bg-brand-light/40' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {text}
      </p>
    </section>
  );
}
