import { useEffect, useRef, useState } from 'react';
import { useUploadStore } from '../../store/uploadStore';
import { discardPendingFile, uploadPendingFile } from '../../utils/postAuth';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { parseApiError } from '../../services/api';
import { downloadPdf, exportJson, setPrivacy as savePrivacy } from '../../services/cvService';
import { getQuota } from '../../services/suggestionService';
import type { CV, ParsePart, Quota, SuggestionRequest } from '../../types';
import { draftFromSaved, emptyDraft } from '../../types/cvDraft';
import type { CvDraft, Entry } from '../../types/cvDraft';
import { mergeParsedIntoDraft, PART_SECTIONS, resumeToDraft } from '../../utils/resumeToDraft';
import { Button } from '../Common/Button';
import { CanvasGroup } from './CanvasGroup';
import type { PreviewTarget } from './CanvasGroup';
import { CvStatus } from './CvStatus';
import { EntryListSection } from './EntryListSection';
import { OthersSection } from './OthersSection';
import { PersonalInfoSection } from './PersonalInfoSection';
import { PreviewPanel } from './PreviewPanel';
import { PrivacyToggle } from './PrivacyToggle';
import { SkillsSection } from './SkillsSection';
import { SuggestButton } from './SuggestButton';
import { SuggestionModal } from './SuggestionModal';
import { Spinner } from '../Common/Spinner';
import { UpgradeModal } from '../Common/UpgradeModal';
import { useAutosave } from './useAutosave';
import type { SaveState } from './useAutosave';

export function CanvasPage() {
  const user = useAuthStore((s) => s.user);
  const [privacy, setPrivacy] = useState<CV['privacy']>('public');
  const [draft, setDraft] = useState<CvDraft>(() => emptyDraft(user?.email ?? ''));
  // The CV section being edited: the preview scrolls to it whenever the user moves to another
  // section (not on every field, so a preview the user scrolled by hand is not yanked back).
  const [focusTarget, setFocusTarget] = useState<PreviewTarget | null>(null);
  const onFormFocus = (e: React.FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-preview-target]');
    const key = el?.dataset.previewTarget as PreviewTarget | undefined;
    if (key) setFocusTarget(key);
  };
  // Every user edit goes through patch(); parsed data is merged with setDraft directly. The
  // flag tells the next save whether it contains a user edit (funnel step "first_edit").
  const userEdited = useRef(false);
  const patch = (p: Partial<CvDraft>) => {
    userEdited.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };

  // 💡 suggestions: one field at a time. The quota is shown on the canvas and refreshed after
  // each request; the server enforces it, so a failed quota load only hides the hint.
  const [quota, setQuota] = useState<Quota | null>(null);
  const refreshQuota = () => {
    getQuota().then(setQuota, () => undefined);
  };
  useEffect(refreshQuota, []);
  const [suggesting, setSuggesting] = useState<{ request: SuggestionRequest; label: string } | null>(null);
  const suggestFor = (field: 'experience' | 'projects', label: string) => (entry: Entry, key: string) =>
    setSuggesting({
      label,
      request: {
        field,
        entry_id: entry.id,
        text: entry[key] ?? '',
        context:
          field === 'experience' ? { title: entry.title ?? '', company: entry.company ?? '' } : { title: entry.name ?? '' },
      },
    });
  // An accepted suggestion is a user edit like typing: it replaces the field and is auto-saved.
  const acceptSuggestion = (request: SuggestionRequest, text: string) => {
    userEdited.current = true;
    setDraft((d) => {
      if (request.field === 'summary') return { ...d, summary: text };
      const list = request.field === 'experience' ? d.experience : d.projects;
      const next = list.map((e) => (e.id === request.entry_id ? { ...e, description: text } : e));
      return request.field === 'experience' ? { ...d, experience: next } : { ...d, projects: next };
    });
  };

  // The saved canvas is restored before editing starts, so nothing typed can be lost and an
  // empty canvas never overwrites a saved one. If loading fails, editing works but is not saved.
  const [load, setLoad] = useState<'loading' | 'ok' | 'failed'>('loading');
  // Parsed parts already merged into the canvas (saved with it, so a reload never re-adds
  // something the user deleted). Parsing runs in three parts in the background: each part
  // fills only its own sections, only the fields the user has left empty, and only once.
  const [appliedParts, setAppliedParts] = useState<ParsePart[]>([]);
  const applied = useRef(new Set<ParsePart>());
  const privacyLoaded = useRef(false);
  const [cv, setCv] = useState<CV | null>(null);
  const { state: saveState, markSaved, flush } = useAutosave(load === 'ok', draft, appliedParts, userEdited);
  // CvStatus keeps the callback it was given when it started polling, so state read here can be
  // stale: whether the saved canvas was restored is kept in a ref.
  const restored = useRef(false);
  const onCvLoaded = (loaded: CV | null) => {
    setCv(loaded);
    if (!restored.current) {
      restored.current = true;
      const savedDraft = loaded?.content ? draftFromSaved(loaded.content) : emptyDraft(user?.email ?? '');
      const savedParts = loaded?.content ? loaded.applied_parts : [];
      setDraft(savedDraft);
      applied.current = new Set(savedParts);
      setAppliedParts(savedParts);
      markSaved(savedDraft, savedParts);
      setLoad('ok');
    }
    if (!loaded) return;
    // CvStatus reports on every status check; take privacy from the server only once so a
    // toggle made while parsing runs is not reset.
    if (!privacyLoaded.current) {
      privacyLoaded.current = true;
      setPrivacy(loaded.privacy);
    }
    const parts = loaded.parsing_parts ?? {};
    const ready = (Object.keys(PART_SECTIONS) as ParsePart[]).filter(
      (p) => parts[p] === 'complete' && !applied.current.has(p),
    );
    if (!ready.length) return;
    ready.forEach((p) => applied.current.add(p));
    setAppliedParts([...applied.current]);
    const sections = ready.flatMap((p) => PART_SECTIONS[p]);
    setDraft((d) => mergeParsedIntoDraft(d, resumeToDraft(loaded.json_resume), user?.email, sections));
  };
  const onCvError = () => {
    if (!restored.current) setLoad('failed');
  };


  // Download PDF (everyone) and Export JSON (Pro): both use the saved CV, so save first.
  const [busy, setBusy] = useState<'pdf' | 'json' | null>(null);
  const [actionError, setActionError] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const runDownload = async (kind: 'pdf' | 'json') => {
    setBusy(kind);
    setActionError('');
    try {
      if (!(await flush())) {
        setActionError("We couldn't save your latest changes, so they can't be included yet. Please try again.");
        return;
      }
      await (kind === 'pdf' ? downloadPdf() : exportJson());
    } catch (err) {
      const e = parseApiError(err);
      if (e.code === 'PRO_REQUIRED') setUpgradeMessage(e.message);
      else setActionError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // The visibility setting is saved straight away; it goes back if saving fails.
  const [privacyError, setPrivacyError] = useState('');
  const changePrivacy = async (next: CV['privacy']) => {
    const previous = privacy;
    setPrivacy(next);
    setPrivacyError('');
    try {
      await savePrivacy(next);
    } catch {
      setPrivacy(previous);
      setPrivacyError("We couldn't save your visibility setting. Please try again.");
    }
  };

  // A file chosen before logging in replaces the saved CV and edits only if the user agrees.
  const uploadStatus = useUploadStore((s) => s.status);
  const pendingFile = useUploadStore((s) => s.pendingFile);
  const replaceCv = async () => {
    setDraft(emptyDraft(user?.email ?? ''));
    applied.current = new Set();
    setAppliedParts([]);
    // Re-load (and save) only once the new CV is in place; if the upload fails, the saved CV
    // is restored again.
    restored.current = false;
    setLoad('loading');
    await uploadPendingFile();
  };

  // A note under a group's heading while its parts are still being read, or if one failed.
  const groupNote = (...groupParts: ParsePart[]) => {
    if (!cv) return undefined;
    const states = groupParts.map((p) => cv.parsing_parts?.[p]);
    const parsing = cv.parsing_status === 'pending' || cv.parsing_status === 'in_progress';
    if (parsing && states.includes('pending')) return { text: 'Filling in from your CV…', busy: true };
    if (cv.parsing_status === 'complete' && states.includes('failed')) {
      return { text: "We couldn't fill this in from your CV. Please add it yourself.", busy: false };
    }
    return undefined;
  };

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:px-6 lg:px-8">
      {/* Title and actions stay in view below the site header while the canvas scrolls
          (tablet and up; on phones the bar would take too much of the screen). */}
      <div
        data-testid="canvas-actions"
        className="mb-6 flex flex-col gap-4 bg-slate-50 md:sticky md:top-16 md:z-[90] md:-mx-6 md:flex-row md:flex-wrap md:items-center md:justify-between md:border-b md:border-slate-200 md:px-6 md:py-3 lg:-mx-8 lg:px-8"
      >
        <div>
          <h1 className="text-2xl font-semibold">Your CV</h1>
          <span className="mt-1 inline-block rounded-full bg-brand-light px-3 py-0.5 text-sm font-medium text-brand-dark">
            {privacy === 'public' ? '🌍 Public' : '🔒 Private'}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => runDownload('pdf')} loading={busy === 'pdf'} disabled={load !== 'ok' || busy !== null}>
            Download PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => runDownload('json')}
            loading={busy === 'json'}
            disabled={load !== 'ok' || busy !== null}
            title="Your CV as JSON Resume (Pro)"
          >
            Export JSON
          </Button>
          <Link
            to="/settings"
            className="inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200"
          >
            Settings
          </Link>
        </div>
        {actionError && (
          <p role="alert" className="rounded-sm bg-warning-bg p-3 text-sm text-warning-text md:basis-full">
            {actionError}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3" onFocus={onFormFocus}>
          <CvStatus onLoaded={onCvLoaded} onError={onCvError} />
          {uploadStatus === 'confirm' && pendingFile && (
            <div role="alertdialog" aria-labelledby="replace-title" className="mb-6 rounded-sm border border-warning-text/30 bg-warning-bg p-4 text-sm">
              <p id="replace-title" className="mb-3 text-warning-text">
                You chose a new CV file ({pendingFile.name}). Uploading it will replace your current CV and your edits.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" onClick={replaceCv}>
                  Replace my CV
                </Button>
                <Button size="sm" variant="secondary" onClick={discardPendingFile}>
                  Keep my current CV
                </Button>
              </div>
            </div>
          )}
          <SaveStatus load={load} state={saveState} />
          {load === 'loading' ? (
            <p className="flex items-center gap-2 py-8 text-slate-600">
              <Spinner className="h-5 w-5" label="" /> Loading your CV…
            </p>
          ) : (
          <>
          {/* Five fixed groups (agreed 2026-10-13). New kinds of CV content go into "Others",
              so the layout does not change every time a section is added. */}
          <CanvasGroup title="Personal details" target="personal" note={groupNote('basics')}>
            <PersonalInfoSection value={draft.personal} onChange={(personal) => patch({ personal })} />
          </CanvasGroup>

          <CanvasGroup title="Professional details" target="summary" note={groupNote('experience', 'extras')}>
            <QuotaHint quota={quota} />
            <div className="mb-6" data-preview-target="summary">
              <div className="mb-3 flex items-center justify-between gap-2">
                <label htmlFor="summary" className="block text-base font-semibold">
                  Professional Summary
                </label>
                <SuggestButton
                  text={draft.summary}
                  label="Professional Summary"
                  onClick={() =>
                    setSuggesting({ label: 'Professional Summary', request: { field: 'summary', text: draft.summary } })
                  }
                />
              </div>
              <textarea
                id="summary"
                rows={4}
                className="field-input"
                placeholder="Brief overview of your experience..."
                value={draft.summary}
                onChange={(e) => patch({ summary: e.target.value })}
              />
            </div>
            <div data-preview-target="experience">
              <EntryListSection
                title="Work Experience"
                currentToggle={{ label: 'I currently work here', endKey: 'end' }}
                itemLabel="Experience"
                addLabel="Add Experience"
                entries={draft.experience}
                onChange={(experience) => patch({ experience })}
                onSuggest={suggestFor('experience', 'Work Experience description')}
                fields={[
                  { key: 'title', label: 'Job Title', placeholder: 'Senior Software Engineer' },
                  { key: 'company', label: 'Company', placeholder: 'Acme Corp' },
                  { key: 'start', label: 'Start Date', type: 'date' },
                  { key: 'end', label: 'End Date', type: 'date' },
                  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What did you achieve?', suggest: true },
                ]}
              />
            </div>
            <div data-preview-target="projects">
              <EntryListSection
                title="Projects"
                itemLabel="Project"
                addLabel="Add Project"
                entries={draft.projects}
                onChange={(projects) => patch({ projects })}
                onSuggest={suggestFor('projects', 'Project description')}
                fields={[
                  { key: 'name', label: 'Project Name', placeholder: 'Final-year project, app, campaign...' },
                  { key: 'url', label: 'Link', placeholder: 'https://...' },
                  { key: 'start', label: 'Start Date', type: 'date' },
                  { key: 'end', label: 'End Date', type: 'date' },
                  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What did you build or deliver?', suggest: true },
                ]}
              />
            </div>
          </CanvasGroup>

          <CanvasGroup title="Education" target="education" note={groupNote('experience')}>
            <EntryListSection
              title="Education"
              showTitle={false}
              itemLabel="Education"
              addLabel="Add Education"
              entries={draft.education}
              onChange={(education) => patch({ education })}
              fields={[
                { key: 'degree', label: 'Degree', placeholder: 'BSc Computer Science' },
                { key: 'school', label: 'School', placeholder: 'University name' },
                { key: 'start', label: 'Start Date', type: 'date' },
                { key: 'end', label: 'End Date', type: 'date' },
                { key: 'score', label: 'Grade / Score', placeholder: 'e.g. CGPA 8.2, First Class, 92%' },
              ]}
            />
          </CanvasGroup>

          <CanvasGroup title="Skills & Certifications" target="skills" note={groupNote('extras')}>
            <div data-preview-target="skills">
              <SkillsSection skills={draft.skills} onChange={(skills) => patch({ skills })} />
            </div>
            <div data-preview-target="certifications">
              <EntryListSection
                title="Certifications"
                itemLabel="Certification"
                addLabel="Add Certification"
                entries={draft.certifications}
                onChange={(certifications) => patch({ certifications })}
                fields={[
                  { key: 'name', label: 'Certification Name', placeholder: 'AWS Certified Solutions Architect' },
                  { key: 'issuer', label: 'Issuer', placeholder: 'Amazon Web Services' },
                  { key: 'date', label: 'Issue Date', type: 'date' },
                ]}
              />
            </div>
          </CanvasGroup>

          <CanvasGroup title="Others" target="others" note={groupNote('extras')}>
            <OthersSection entries={draft.others} onChange={(others) => patch({ others })} />
          </CanvasGroup>

          </>
          )}
          <PrivacyToggle value={privacy} onChange={changePrivacy} error={privacyError} />
        </div>
        <div className="lg:col-span-2">
          <PreviewPanel draft={draft} focusTarget={focusTarget} />
        </div>
      </div>
      {suggesting && (
        <SuggestionModal
          request={suggesting.request}
          label={suggesting.label}
          onAccept={(text) => acceptSuggestion(suggesting.request, text)}
          onUsed={refreshQuota}
          onClose={() => setSuggesting(null)}
        />
      )}
      {upgradeMessage && <UpgradeModal message={upgradeMessage} onClose={() => setUpgradeMessage(null)} />}
    </div>
  );
}

/** One line under "Professional details": what 💡 does and how many suggestions are left. */
function QuotaHint({ quota }: { quota: Quota | null }) {
  const known = typeof quota?.remaining === 'number';
  const left = known
    ? quota!.plan === 'free'
      ? `${quota!.remaining} free suggestion${quota!.remaining === 1 ? '' : 's'} left this month.`
      : `${quota!.remaining} of ${quota!.limit} suggestions left this month.`
    : '';
  return (
    <p data-testid="quota-hint" className="mb-4 text-sm text-slate-600">
      <span aria-hidden="true">💡</span> Improve rewrites a field in a clear, professional CV style. {left}
    </p>
  );
}

function SaveStatus({ load, state }: { load: 'loading' | 'ok' | 'failed'; state: SaveState }) {
  if (load === 'loading') return null;
  const [text, tone] =
    load === 'failed'
      ? ["We couldn't load your saved CV, so changes on this page are not being saved. Refresh to try again.", 'warn']
      : state === 'saving'
        ? ['Saving…', 'muted']
        : state === 'saved'
          ? ['All changes saved', 'muted']
          : state === 'error'
            ? ["Couldn't save your latest changes. Retrying…", 'warn']
            : ['Your changes save automatically.', 'muted'];
  return (
    <p
      role="status"
      data-testid="save-status"
      className={`mb-6 text-sm ${tone === 'warn' ? 'rounded-sm bg-warning-bg p-3 text-warning-text' : 'text-slate-600'}`}
    >
      {text}
    </p>
  );
}
