import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseApiError } from '../../services/api';
import { createAlignment } from '../../services/alignmentService';
import { getQuota } from '../../services/suggestionService';
import type { Quota } from '../../types';
import { Button } from '../Common/Button';
import { UpgradeModal } from '../Common/UpgradeModal';
import { HowItWorks } from './HowItWorks';

/** "Align to job": paste a job spec; the result opens on /align/{id}. */
export function AlignStartPage() {
  const navigate = useNavigate();
  const [spec, setSpec] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  useEffect(() => {
    getQuota().then(setQuota, () => undefined);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const run = await createAlignment(spec);
      navigate(`/align/${run.id}`);
    } catch (err) {
      const e = parseApiError(err);
      if (e.code === 'PRO_REQUIRED') setUpgrade(e.message);
      else setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:px-6 lg:px-8">
      <Link to="/dashboard" className="text-sm text-brand-dark hover:underline">
        ‹ Back to dashboard
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-5" aria-labelledby="align-title">
          <div className="flex items-center gap-2.5">
            <h1 id="align-title" className="text-base font-semibold">
              Align to a job
            </h1>
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-dark">Pro</span>
          </div>
          <p className="text-sm text-slate-600">
            Paste a job spec. We suggest how to position this CV for it, which gaps to close and what to consider adding.
          </p>
          <label htmlFor="job-spec" className="text-sm font-semibold">
            Job description
          </label>
          <textarea
            id="job-spec"
            rows={10}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Paste the job description here…"
            className="w-full resize-none rounded-sm border border-slate-300 p-3 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} loading={busy} disabled={busy || spec.trim().length === 0}>
              {busy ? 'Reading the job…' : 'Align CV to this job'}
            </Button>
            <span className="text-xs text-slate-500">
              Uses 1 suggestion{quota ? ` (${quota.remaining} of ${quota.limit} left this month)` : ''}. Your job spec is deleted
              after the result.
            </span>
          </div>
          {error && (
            <p role="alert" className="rounded-sm bg-warning-bg p-3 text-sm text-warning-text">
              {error}
            </p>
          )}
        </section>
        <div className="self-start">
          <HowItWorks title="How it works" />
        </div>
      </div>
      {upgrade && <UpgradeModal message={upgrade} onClose={() => setUpgrade(null)} />}
    </div>
  );
}
