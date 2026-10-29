import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseApiError } from '../../services/api';
import { downloadPdf, exportJson, uploadCv } from '../../services/cvService';
import { getDashboard } from '../../services/dashboardService';
import { useAuthStore } from '../../store/authStore';
import type { Dashboard } from '../../types';
import { Button } from '../Common/Button';
import { Spinner } from '../Common/Spinner';
import { UpgradeModal } from '../Common/UpgradeModal';
import { ReplaceCvModal } from '../Canvas/ReplaceCvModal';

const cardClass = 'flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-5';
const linkCard = `${cardClass} hover:border-brand hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand`;

function CardLink({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <Link to={to} className={linkCard}>
      <span className="flex justify-between text-sm text-slate-600">
        {title}
        <span aria-hidden="true">›</span>
      </span>
      {children}
    </Link>
  );
}

/** Home for logged-in users: CV strength, ATS format score, the Canvas and the downloads. */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    getDashboard().then(
      (d) => !cancelled && setData(d),
      (err) => !cancelled && setError(parseApiError(err).message),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const upload = async (file: File) => {
    setUploadOpen(false);
    try {
      await uploadCv(file);
      navigate('/canvas');
    } catch (err) {
      setUploadError(parseApiError(err).message);
    }
  };

  const [busy, setBusy] = useState<'pdf' | 'json' | null>(null);
  const [actionError, setActionError] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const download = async (kind: 'pdf' | 'json') => {
    setBusy(kind);
    setActionError('');
    try {
      await (kind === 'pdf' ? downloadPdf() : exportJson());
      navigate('/next');
    } catch (err) {
      const e = parseApiError(err);
      if (e.code === 'PRO_REQUIRED') setUpgradeMessage(e.message);
      else setActionError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      {error && (
        <p role="alert" className="rounded-sm bg-warning-bg p-3 text-sm text-warning-text">
          {error}
        </p>
      )}
      {!data && !error && <Spinner />}
      {data?.state === 'no_cv' && (
        <section className={`${cardClass} max-w-xl`} aria-labelledby="upload-title">
          <h2 id="upload-title" className="text-lg font-semibold">
            Start with your CV
          </h2>
          <p className="text-sm text-slate-700">
            Upload your CV (PDF or Word) and we fill in the Canvas for you. Your scores appear here once you have a CV.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setUploadOpen(true)}>Upload your CV</Button>
            <Link
              to="/canvas"
              className="inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200"
            >
              Or start from scratch
            </Link>
          </div>
          {uploadError && (
            <p role="alert" className="text-sm text-error-text">
              {uploadError}
            </p>
          )}
        </section>
      )}
      {data?.state === 'parsing' && (
        <Link to="/canvas" className={`${linkCard} max-w-xl`}>
          <span className="flex items-center gap-2 font-semibold">
            <Spinner className="h-4 w-4" /> We are reading your CV
          </span>
          <span className="text-sm text-slate-700">Your scores appear here when it is done. You can open the Canvas meanwhile.</span>
        </Link>
      )}
      {data?.state === 'needs_details' && (
        <Link to="/canvas" className={`${linkCard} max-w-xl`}>
          <span className="font-semibold">We couldn't read your CV automatically</span>
          <span className="text-sm text-slate-700">Enter your details on the Canvas and your scores will appear here.</span>
        </Link>
      )}
      {data?.state === 'ready' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {data.cv_strength && (
            <CardLink to="/canvas" title="CV strength">
              <div className="text-4xl font-semibold">{data.cv_strength.percent}%</div>
              <div
                role="progressbar"
                aria-label="CV strength"
                aria-valuenow={data.cv_strength.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-slate-200"
              >
                <div className="h-2 bg-brand" style={{ width: `${data.cv_strength.percent}%` }} />
              </div>
              {data.cv_strength.next_step && (
                <p className="text-sm text-slate-800">Next step: {data.cv_strength.next_step.text}</p>
              )}
              <p className="text-xs text-slate-600">Complete CVs are easier for recruiters to read and search.</p>
            </CardLink>
          )}
          <CardLink to="/canvas" title="ATS format score">
            {data.ats ? (
              <>
                <div className="text-4xl font-semibold">{data.ats.score}</div>
                <p className="text-sm text-slate-800">
                  {data.ats.first_fix
                    ? `First fix: ${data.ats.first_fix.text} (+${data.ats.first_fix.points})`
                    : 'Every check passes.'}
                </p>
                <p className="text-xs text-slate-600">
                  How well your CV is written for applicant tracking systems. Not a job match.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-700">We couldn't work out your score just now. Please refresh in a moment.</p>
            )}
          </CardLink>
          <CardLink to="/canvas" title="Update CV or start a new CV">
            <p className="text-sm text-slate-800">Edit your CV on the Canvas, or start again from a new upload.</p>
          </CardLink>
          <div className={cardClass}>
            <div className="text-sm text-slate-600">Download PDF and JSON</div>
            <p className="text-sm text-slate-800">Your CV as a PDF, or as JSON Resume data for other tools.</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={busy === 'pdf'} disabled={busy !== null} onClick={() => download('pdf')}>
                Download PDF
              </Button>
              <Button size="sm" variant="secondary" loading={busy === 'json'} disabled={busy !== null} onClick={() => download('json')}>
                Export JSON{data.plan === 'free' && <span className="text-xs text-brand">Pro</span>}
              </Button>
            </div>
            {actionError && (
              <p role="alert" className="text-sm text-error-text">
                {actionError}
              </p>
            )}
          </div>
        </div>
      )}
      {uploadOpen && <ReplaceCvModal hasCv={false} onUpload={upload} onClose={() => setUploadOpen(false)} />}
      {upgradeMessage && <UpgradeModal message={upgradeMessage} onClose={() => setUpgradeMessage(null)} />}
      {user && <span className="sr-only">Signed in as {user.email}</span>}
    </div>
  );
}
