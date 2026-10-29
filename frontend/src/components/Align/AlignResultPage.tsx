import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { parseApiError } from '../../services/api';
import { applyAlignment, downloadJobPdf, getAlignment, previewAlignment } from '../../services/alignmentService';
import { getQuota } from '../../services/suggestionService';
import type { Alignment, AtsScore, Gap, Quota, Selection } from '../../types';
import { Button } from '../Common/Button';
import { Spinner } from '../Common/Spinner';
import { HowItWorks } from './HowItWorks';

const COLLAPSED_ROWS = 2;
const PREVIEW_DELAY_MS = 250;

/** Shows the first two rows; the rest opens with "Show N more". */
function Collapsible({ rows, label }: { rows: ReactNode[]; label: string }) {
  const [open, setOpen] = useState(false);
  const hidden = rows.length - COLLAPSED_ROWS;
  const shown = open || hidden <= 0 ? rows : rows.slice(0, COLLAPSED_ROWS);
  return (
    <div>
      <ul className="flex flex-col gap-1.5" aria-label={label}>
        {shown.map((row, i) => (
          <li key={i}>{row}</li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1.5 text-sm text-brand-dark hover:underline">
          {open ? 'Show less' : `Show ${hidden} more ›`}
        </button>
      )}
    </div>
  );
}

const requirementsLine = (a: Alignment) => {
  const r = a.requirements;
  const parts = [
    `${r.core_skills.length} must-have skill${r.core_skills.length === 1 ? '' : 's'}`,
    `${r.secondary_skills.length} other skill${r.secondary_skills.length === 1 ? '' : 's'}`,
    r.years_required ? `${r.years_required}+ years` : null,
    r.needs_management ? 'management needed' : null,
    r.sector ? `sector ${r.sector}` : null,
  ];
  return parts.filter(Boolean).join(', ');
};

/** The result of a job alignment: score before and after the ticked changes, then update or download. */
export function AlignResultPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<Alignment | null>(null);
  const [loadError, setLoadError] = useState('');
  const [quota, setQuota] = useState<Quota | null>(null);
  const [headline, setHeadline] = useState(true);
  const [ticked, setTicked] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [after, setAfter] = useState<AtsScore | null>(null);
  const [scoring, setScoring] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [busy, setBusy] = useState<'update' | 'download' | null>(null);
  const [actionError, setActionError] = useState('');
  const [downloaded, setDownloaded] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAlignment(id).then(
      (r) => !cancelled && setRun(r),
      (err) => !cancelled && setLoadError(parseApiError(err).message),
    );
    getQuota().then((q) => !cancelled && setQuota(q), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  const selection: Selection = useMemo(
    () => ({ use_headline: headline && !!run?.positioning, skills: ticked }),
    [headline, ticked, run],
  );

  // The "after" score follows the ticks live. It is recomputed by the rules on the server (no AI), a moment
  // after the last tick; a slow answer to an earlier tick never replaces a newer one.
  const latest = useRef(0);
  useEffect(() => {
    if (!run) return;
    const mine = ++latest.current;
    setScoring(true);
    const t = setTimeout(() => {
      previewAlignment(run.id, selection).then(
        (score) => {
          if (mine !== latest.current) return;
          setAfter(score);
          setScoring(false);
        },
        () => {
          if (mine !== latest.current) return;
          setScoring(false);
        },
      );
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(t);
  }, [run, selection]);

  const toggleSkill = (skill: string, on: boolean) =>
    setTicked((t) => (on ? [...t.filter((s) => s !== skill), skill] : t.filter((s) => s !== skill)));
  const dismiss = (skill: string) => setDismissed((d) => [...d, skill]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 md:px-6 lg:px-8">
        <p role="alert" className="rounded-sm bg-warning-bg p-3 text-sm text-warning-text">
          {loadError}
        </p>
        <Link to="/align" className="mt-4 inline-block text-sm text-brand-dark hover:underline">
          ‹ Align to a job
        </Link>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="px-4 py-10">
        <Spinner />
      </div>
    );
  }

  const gaps: Gap[] = run.gaps;
  const missingGaps = gaps.filter((g) => g.status === 'missing');
  const headlineCovers = (g: Gap) => g.by_headline && selection.use_headline;
  const addressedTicked = missingGaps.filter((g) => ticked.includes(g.skill));
  const addressedByHeadline = missingGaps.filter((g) => headlineCovers(g) && !ticked.includes(g.skill));
  const stillMissing = missingGaps.filter(
    (g) => !ticked.includes(g.skill) && !headlineCovers(g) && !dismissed.includes(g.skill),
  );
  const dismissedGaps = missingGaps.filter((g) => dismissed.includes(g.skill) && !ticked.includes(g.skill));
  const covered = gaps.filter((g) => g.status === 'covered');
  const changes = (selection.use_headline ? 1 : 0) + ticked.length;
  const now = run.score.score;
  const afterScore = after?.score ?? now;
  const diff = afterScore - now;

  const update = async () => {
    setBusy('update');
    setActionError('');
    try {
      await applyAlignment(run.id, selection);
      navigate('/canvas'); // the Canvas shows the updated CV
    } catch (err) {
      setActionError(parseApiError(err).message);
      setBusy(null);
    }
  };
  const download = async () => {
    setBusy('download');
    setActionError('');
    setDownloaded('');
    try {
      const name = await downloadJobPdf(run.id, selection);
      setDownloaded(`Downloaded "${name}". Your saved CV is unchanged.`);
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:px-6 lg:px-8">
      <section className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 md:p-6" aria-labelledby="result-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="result-title" className="text-base font-semibold">
              Align to a job: {run.requirements.job_title}
            </h1>
            <p className="text-xs text-slate-600">
              What we read from the job spec: {requirementsLine(run)}. Your job spec is deleted; these notes stay with this
              result.
            </p>
          </div>
          <Link to="/align" className="whitespace-nowrap text-sm text-brand-dark hover:underline">
            Run another job
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* score */}
          <div className="flex flex-col gap-1.5 lg:border-r lg:border-slate-200 lg:pr-6">
            <span className="text-sm text-slate-600">Job match score</span>
            <div className="mt-1 flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">Your saved CV now</span>
              <span data-testid="score-now" className="text-2xl font-medium leading-tight text-slate-500">
                {now}
              </span>
            </div>
            <div
              aria-busy={scoring}
              className="mt-2 flex flex-col gap-0.5 rounded-md border border-emerald-200 bg-success-bg px-3 py-2.5"
            >
              <span className="text-xs font-semibold text-success-text">After your ticked changes</span>
              <span data-testid="score-after" className="text-5xl font-bold leading-none text-success-text">
                {afterScore}
              </span>
              <span className="text-xs text-success-text">
                {diff === 0 ? 'No change yet: tick items below' : `${diff > 0 ? '+' : ''}${diff}, updates as you tick`}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              60 points: how your CV is written for ATS tools. 40 points: how well it matches this job. Our own checklist, not a
              promise about any employer&apos;s system.
            </p>
            <button
              type="button"
              onClick={() => setShowChecks(!showChecks)}
              aria-expanded={showChecks}
              className="mt-1 self-start text-sm text-brand-dark hover:underline"
            >
              {showChecks ? 'Hide the checks' : 'See the checks ›'}
            </button>
            {showChecks && (
              <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-700" aria-label="Checks">
                {(after ?? run.score).checks.map((c) => (
                  <li key={c.id}>
                    <span className={c.passed ? 'text-success-text' : 'text-warning-text'}>
                      {c.points}/{c.max}
                    </span>{' '}
                    {c.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {/* positioning */}
            <div>
              <h2 className="text-sm font-semibold">Positioning (your headline)</h2>
              {run.positioning ? (
                <>
                  <div className="mt-1 text-sm text-slate-600 line-through">{run.positioning.current || '(no headline yet)'}</div>
                  <label className="mt-1 flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={headline}
                      onChange={(e) => setHeadline(e.target.checked)}
                      className="h-[18px] w-[18px]"
                    />
                    <span>
                      <span className="sr-only">Use this headline: </span>
                      {run.positioning.proposed}
                    </span>
                  </label>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  We couldn&apos;t propose a headline that stays true to your CV, so your headline stays as it is.
                </p>
              )}
            </div>

            {/* gaps */}
            <div>
              <h2 className="text-sm font-semibold">Gaps for this job</h2>
              <div className="mt-2 flex flex-col gap-2">
                {stillMissing.length === 0 ? (
                  <p className="text-sm text-slate-700">Nothing missing.</p>
                ) : (
                  stillMissing.map((g) => (
                    <div key={g.skill} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-sm bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning-text">Missing</span>
                      <span className="grow text-sm text-slate-700">{g.skill}</span>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleSkill(g.skill, true)}
                          aria-label={`I have ${g.skill}: add to my skills`}
                          className="h-[18px] w-[18px]"
                        />
                        I have this: add to my skills
                      </label>
                      <button
                        type="button"
                        onClick={() => dismiss(g.skill)}
                        aria-label={`Dismiss ${g.skill}`}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))
                )}
              </div>

              {addressedTicked.length + addressedByHeadline.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-brand-dark">
                    Addressed ({addressedTicked.length + addressedByHeadline.length})
                  </h3>
                  <div className="mt-1.5">
                    <Collapsible
                      label="Addressed"
                      rows={[
                        ...addressedTicked.map((g) => (
                          <div key={g.skill} className="flex items-center gap-2.5 text-sm text-slate-700">
                            <span aria-hidden="true" className="font-bold text-success-text">
                              ✓
                            </span>
                            <span>{g.skill}: you ticked it, so it is added to your skills.</span>
                            <button
                              type="button"
                              onClick={() => toggleSkill(g.skill, false)}
                              aria-label={`Undo ${g.skill}`}
                              className="text-xs text-slate-600 hover:underline"
                            >
                              Undo
                            </button>
                          </div>
                        )),
                        ...addressedByHeadline.map((g) => (
                          <div key={g.skill} className="flex items-center gap-2.5 text-sm text-slate-700">
                            <span aria-hidden="true" className="font-bold text-success-text">
                              ✓
                            </span>
                            <span>{g.skill}: now in your headline.</span>
                          </div>
                        )),
                      ]}
                    />
                  </div>
                </div>
              )}

              {covered.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-success-text">Covered by your CV ({covered.length})</h3>
                  <div className="mt-1.5">
                    <Collapsible
                      label="Covered"
                      rows={covered.map((g) => (
                        <div key={g.skill} className="flex items-center gap-2.5 text-sm text-slate-700">
                          <span className="rounded-sm bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success-text">Covered</span>
                          {g.skill}
                        </div>
                      ))}
                    />
                  </div>
                </div>
              )}
              {dismissedGaps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDismissed([])}
                  className="mt-3 text-sm text-slate-600 hover:underline"
                >
                  Show {dismissedGaps.length} dismissed
                </button>
              )}
              <p className="mt-3 text-xs text-slate-500">Nothing is added to your CV unless you tick it. Only add what is true.</p>
            </div>

            {/* consider */}
            {run.consider.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold">Consider (ideas, never added to your CV)</h2>
                <ul className="mt-1.5 list-disc pl-5 text-sm leading-relaxed text-slate-700">
                  {run.consider.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* the two choices */}
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold">
            What do you want to do with the {changes} change{changes === 1 ? '' : 's'} you ticked?
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-md border border-slate-300 p-4">
              <span className="text-sm font-semibold">Update my CV</span>
              <span className="text-sm leading-relaxed text-slate-700">
                Your saved CV changes: the new headline and the skills you ticked. We then open the Canvas so you can see the
                updated CV. Every download after this has them.
              </span>
              <Button className="self-start" onClick={update} loading={busy === 'update'} disabled={busy !== null || changes === 0}>
                Update my CV
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-slate-300 p-4">
              <span className="text-sm font-semibold">Download a version for this job</span>
              <span className="text-sm leading-relaxed text-slate-700">
                A PDF with the same changes, for this job only. Your saved CV stays as it is. The job version is not kept: run the
                alignment again to make it again.
              </span>
              <Button
                className="self-start"
                variant="secondary"
                onClick={download}
                loading={busy === 'download'}
                disabled={busy !== null}
              >
                Download PDF for this job
              </Button>
            </div>
          </div>
          {actionError && (
            <p role="alert" className="rounded-sm bg-warning-bg p-3 text-sm text-warning-text">
              {actionError}
            </p>
          )}
          {downloaded && (
            <p role="status" className="rounded-sm bg-success-bg p-3 text-sm text-success-text">
              {downloaded}
            </p>
          )}
          <HowItWorks />
          <p className="text-xs text-slate-500">
            This used 1 suggestion{quota ? ` (${quota.remaining} of ${quota.limit} left this month)` : ''}. Job alignment is part of
            Pro.
          </p>
        </div>
      </section>
    </div>
  );
}
