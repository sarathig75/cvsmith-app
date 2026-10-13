import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { CV } from '../../types';
import { emptyDraft } from '../../types/cvDraft';
import type { CvDraft } from '../../types/cvDraft';
import { mergeParsedIntoDraft, resumeToDraft } from '../../utils/resumeToDraft';
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

  // Parsing finishes in the background while the user may already be typing: fill only
  // the fields they have left empty, and apply each parsed result once.
  const appliedResume = useRef<string | null>(null);
  const privacyLoaded = useRef(false);
  const onCvLoaded = (cv: CV | null) => {
    if (!cv) return;
    // CvStatus reports on every status check; take privacy from the server only once so a
    // toggle made while parsing runs is not reset.
    if (!privacyLoaded.current) {
      privacyLoaded.current = true;
      setPrivacy(cv.privacy);
    }
    if (cv.parsing_status !== 'complete') return;
    const key = JSON.stringify(cv.json_resume);
    if (appliedResume.current === key) return;
    appliedResume.current = key;
    setDraft((d) => mergeParsedIntoDraft(d, resumeToDraft(cv.json_resume), user?.email));
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
          <CanvasGroup title="Personal details">
            <PersonalInfoSection value={draft.personal} onChange={(personal) => patch({ personal })} />
          </CanvasGroup>

          <CanvasGroup title="Professional details">
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

          <CanvasGroup title="Education">
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

          <CanvasGroup title="Skills & Certifications">
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

          <CanvasGroup title="Others">
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
