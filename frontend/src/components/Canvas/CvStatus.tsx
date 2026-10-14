import { useEffect, useState } from 'react';
import { parseApiError } from '../../services/api';
import { getCv } from '../../services/cvService';
import { useUploadStore } from '../../store/uploadStore';
import type { CV, ParsePart } from '../../types';
import { Spinner } from '../Common/Spinner';

export const POLL_INTERVAL_MS = 2000;
/** Stop checking after this long; the worker's own time limit is shorter, so this only guards against a stuck job. */
export const POLL_GIVE_UP_MS = 3 * 60 * 1000;

const isParsing = (cv: CV | null) => cv?.parsing_status === 'pending' || cv?.parsing_status === 'in_progress';

/**
 * Shows the uploaded CV and its parsing status from GET /api/cv. While parsing runs in the
 * background it re-checks quietly; the user can keep editing the canvas the whole time.
 */
export function CvStatus({ onLoaded, onError }: { onLoaded?: (cv: CV | null) => void; onError?: () => void }) {
  const uploadStatus = useUploadStore((s) => s.status);
  const uploadError = useUploadStore((s) => s.error);
  const [state, setState] = useState<{ loading: boolean; cv: CV | null; error: string | null; gaveUp: boolean }>({
    loading: true,
    cv: null,
    error: null,
    gaveUp: false,
  });

  useEffect(() => {
    if (uploadStatus === 'uploading') return; // refetch once the post-signup upload settles
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setState((s) => ({ ...s, loading: s.cv === null, error: null, gaveUp: false }));

    const check = () => {
      getCv()
        .then((cv) => {
          if (cancelled) return;
          const gaveUp = isParsing(cv) && Date.now() - startedAt >= POLL_GIVE_UP_MS;
          setState({ loading: false, cv, error: null, gaveUp });
          onLoaded?.(cv);
          if (isParsing(cv) && !gaveUp) timer = setTimeout(check, POLL_INTERVAL_MS);
        })
        .catch((err) => {
          if (cancelled) return;
          setState((s) => ({ ...s, loading: false, error: parseApiError(err).message }));
          onError?.();
        });
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadStatus]);

  const busy = uploadStatus === 'uploading' || state.loading;
  const cv = state.cv;
  return (
    <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm" aria-live="polite" data-testid="cv-status">
      <div className="mb-1 font-semibold">Uploaded CV</div>
      {busy ? (
        <span className="flex items-center gap-2 text-slate-600">
          <Spinner className="h-4 w-4" label="Loading CV status" /> {uploadStatus === 'uploading' ? 'Uploading your CV…' : 'Checking your CV…'}
        </span>
      ) : state.error && !cv ? (
        <p className="text-error-text">Could not load CV status: {state.error}</p>
      ) : !cv || cv.parsing_status === 'not_uploaded' ? (
        <p className="text-slate-600">No CV uploaded yet.</p>
      ) : isParsing(cv) && state.gaveUp ? (
        <p className="text-slate-800">
          {cv.title} - Reading your CV is taking longer than usual. Keep editing; refresh the page later to see the result.
        </p>
      ) : isParsing(cv) ? (
        <div className="text-slate-800">
          <p>{cv.title} - Reading your CV. You can start editing now; we only fill in fields you leave empty.</p>
          <PartProgress cv={cv} />
        </div>
      ) : cv.parsing_status === 'complete' ? (
        <p className="text-slate-800">{cv.title} - We filled in details from your CV. Please review and edit anything.</p>
      ) : (
        <p className="text-error-text">
          {cv.title} - We couldn't read your CV automatically{cv.parsing_error ? `: ${cv.parsing_error}` : '.'} You can enter your
          details below.
        </p>
      )}
      {uploadError && !busy && <p role="alert" className="mt-2 text-error-text">Your CV could not be uploaded: {uploadError}</p>}
    </div>
  );
}

const PART_LABELS: [ParsePart, string][] = [
  ['basics', 'Contact details'],
  ['experience', 'Work & education'],
  ['extras', 'Skills & more'],
];

/** One line per parsing part, ticked off as each part arrives, so the wait is visibly moving. */
function PartProgress({ cv }: { cv: CV }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1" aria-label="Reading progress">
      {PART_LABELS.map(([part, label]) => {
        const status = cv.parsing_parts?.[part] ?? 'pending';
        return (
          <li key={part} className="flex items-center gap-1.5" data-testid={`part-${part}`} data-status={status}>
            {status === 'pending' ? (
              <Spinner className="h-3.5 w-3.5" label="" />
            ) : (
              <span aria-hidden="true" className={status === 'complete' ? 'text-success-text' : 'text-error-text'}>
                {status === 'complete' ? '✓' : '✕'}
              </span>
            )}
            <span className={status === 'pending' ? 'text-slate-600' : ''}>
              {label}
              <span className="sr-only">: {status === 'pending' ? 'reading' : status === 'complete' ? 'done' : 'could not be read'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
