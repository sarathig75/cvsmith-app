import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { CV, ParsePart } from '../../types';
import { emptyDraft } from '../../types/cvDraft';
import type { CvDraft } from '../../types/cvDraft';
import { mergeParsedIntoDraft, PART_SECTIONS, resumeToDraft } from '../../utils/resumeToDraft';
import { Button } from '../Common/Button';
import { CanvasGroup } from './CanvasGroup';
import { CvStatus } from './CvStatus';
import { EntryListSection } from './EntryListSection';
import { OthersSection } from './OthersSection';
import { PersonalInfoSection } from './PersonalInfoSection';
import { PreviewPanel } from './PreviewPanel';
import { PrivacyToggle } from './PrivacyToggle';
import { SkillsSection } from './SkillsSection';

export function CanvasPage() {
  const user = useAuthStore((s) => s.user);
  const [privacy, setPrivacy] = useState<CV['privacy']>('public');
  const [draft, setDraft] = useState<CvDraft>(() => emptyDraft(user?.email ?? ''));
  const patch = (p: Partial<CvDraft>) => setDraft((d) => ({ ...d, ...p }));

  // Parsing runs in the background in three parts while the user may already be typing. Each
  // part fills only its own sections, only the fields the user has left empty, and only once.
  const appliedParts = useRef(new Set<ParsePart>());
  const privacyLoaded = useRef(false);
  const [cv, setCv] = useState<CV | null>(null);
  const onCvLoaded = (loaded: CV | null) => {
    setCv(loaded);
    if (!loaded) return;
    // CvStatus reports on every status check; take privacy from the server only once so a
    // toggle made while parsing runs is not reset.
    if (!privacyLoaded.current) {
      privacyLoaded.current = true;
      setPrivacy(loaded.privacy);
    }
    const parts = loaded.parsing_parts ?? {};
    // A new upload starts with every part pending: its parts may be applied again.
    if (Object.values(parts).every((s) => s === 'pending')) appliedParts.current.clear();
    const ready = (Object.keys(PART_SECTIONS) as ParsePart[]).filter(
      (p) => parts[p] === 'complete' && !appliedParts.current.has(p),
    );
    if (!ready.length) return;
    ready.forEach((p) => appliedParts.current.add(p));
    const sections = ready.flatMap((p) => PART_SECTIONS[p]);
    setDraft((d) => mergeParsedIntoDraft(d, resumeToDraft(loaded.json_resume), user?.email, sections));
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
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your CV</h1>
          <span className="mt-1 inline-block rounded-full bg-brand-light px-3 py-0.5 text-sm font-medium text-brand-dark">
            {privacy === 'public' ? '🌍 Public' : '🔒 Private'}
          </span>
        </div>
        <div className="flex gap-3">
          <Button disabled title="PDF download is coming in a later release">
            Download PDF
          </Button>
          <Link
            to="/settings"
            className="inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200"
          >
            Settings
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <CvStatus onLoaded={onCvLoaded} />
          <p className="mb-6 rounded-sm bg-warning-bg p-3 text-sm text-warning-text" role="note">
            Edits are kept on this page only for now. Saving your CV is coming soon.
          </p>
          {/* Five fixed groups (agreed 2026-10-13). New kinds of CV content go into "Others",
              so the layout does not change every time a section is added. */}
          <CanvasGroup title="Personal details" note={groupNote('basics')}>
            <PersonalInfoSection value={draft.personal} onChange={(personal) => patch({ personal })} />
          </CanvasGroup>

          <CanvasGroup title="Professional details" note={groupNote('experience', 'extras')}>
            <div className="mb-6">
              <label htmlFor="summary" className="mb-3 block text-base font-semibold">
                Professional Summary
              </label>
              <textarea
                id="summary"
                rows={4}
                className="field-input"
                placeholder="Brief overview of your experience..."
                value={draft.summary}
                onChange={(e) => patch({ summary: e.target.value })}
              />
            </div>
            <EntryListSection
              title="Work Experience"
              currentToggle={{ label: 'I currently work here', endKey: 'end' }}
              itemLabel="Experience"
              addLabel="Add Experience"
              entries={draft.experience}
              onChange={(experience) => patch({ experience })}
              fields={[
                { key: 'title', label: 'Job Title', placeholder: 'Senior Software Engineer' },
                { key: 'company', label: 'Company', placeholder: 'Acme Corp' },
                { key: 'start', label: 'Start Date', type: 'date' },
                { key: 'end', label: 'End Date', type: 'date' },
                { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What did you achieve?' },
              ]}
            />
            <EntryListSection
              title="Projects"
              itemLabel="Project"
              addLabel="Add Project"
              entries={draft.projects}
              onChange={(projects) => patch({ projects })}
              fields={[
                { key: 'name', label: 'Project Name', placeholder: 'Final-year project, app, campaign...' },
                { key: 'url', label: 'Link', placeholder: 'https://...' },
                { key: 'start', label: 'Start Date', type: 'date' },
                { key: 'end', label: 'End Date', type: 'date' },
                { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What did you build or deliver?' },
              ]}
            />
          </CanvasGroup>

          <CanvasGroup title="Education" note={groupNote('experience')}>
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

          <CanvasGroup title="Skills & Certifications" note={groupNote('extras')}>
            <SkillsSection skills={draft.skills} onChange={(skills) => patch({ skills })} />
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
          </CanvasGroup>

          <CanvasGroup title="Others" note={groupNote('extras')}>
            <OthersSection entries={draft.others} onChange={(others) => patch({ others })} />
          </CanvasGroup>

          <PrivacyToggle value={privacy} onChange={setPrivacy} />
        </div>
        <div className="lg:col-span-2">
          <PreviewPanel draft={draft} />
        </div>
      </div>
    </div>
  );
}
