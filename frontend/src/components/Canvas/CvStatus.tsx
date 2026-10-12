import { useEffect, useState } from 'react';
import { parseApiError } from '../../services/api';
import { getCv } from '../../services/cvService';
import { useUploadStore } from '../../store/uploadStore';
import type { CV } from '../../types';
import { Spinner } from '../Common/Spinner';

const statusText: Record<CV['parsing_status'], string> = {
  pending: 'Uploaded - waiting to be processed',
  in_progress: 'Processing',
  complete: 'Processed',
  failed: 'Processing failed',
};

/** Shows the uploaded CV and its parsing status from GET /api/cv. */
export function CvStatus({ onLoaded }: { onLoaded?: (cv: CV | null) => void }) {
  const uploadStatus = useUploadStore((s) => s.status);
  const uploadError = useUploadStore((s) => s.error);
  const [state, setState] = useState<{ loading: boolean; cv: CV | null; error: string | null }>({ loading: true, cv: null, error: null });

  useEffect(() => {
    if (uploadStatus === 'uploading') return; // refetch once the post-signup upload settles
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getCv()
      .then((cv) => {
        if (cancelled) return;
        setState({ loading: false, cv, error: null });
        onLoaded?.(cv);
      })
      .catch((err) => !cancelled && setState({ loading: false, cv: null, error: parseApiError(err).message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadStatus]);

  const busy = uploadStatus === 'uploading' || state.loading;
  return (
    <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm" aria-live="polite" data-testid="cv-status">
      <div className="mb-1 font-semibold">Uploaded CV</div>
      {busy ? (
        <span className="flex items-center gap-2 text-slate-600">
          <Spinner className="h-4 w-4" label="Loading CV status" /> {uploadStatus === 'uploading' ? 'Uploading your CV…' : 'Checking your CV…'}
        </span>
      ) : state.error ? (
        <p className="text-error-text">Could not load CV status: {state.error}</p>
      ) : state.cv ? (
        <p className="text-slate-800">
          {state.cv.title} - <span className="font-medium">{statusText[state.cv.parsing_status]}</span>
        </p>
      ) : (
        <p className="text-slate-600">No CV uploaded yet.</p>
      )}
      {uploadError && !busy && <p role="alert" className="mt-2 text-error-text">Your CV could not be uploaded: {uploadError}</p>}
    </div>
  );
}
