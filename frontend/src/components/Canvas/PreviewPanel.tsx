import type { CvDraft } from '../../types/cvDraft';
import { formatDate } from '../../utils/dates';

export function PreviewPanel({ draft }: { draft: CvDraft }) {
  const p = draft.personal;
  const contact = [p.email, p.phone, p.location, p.linkedin, p.portfolio].filter(Boolean);
  const range = (e: Record<string, string>) =>
    [formatDate(e.start), e.current === 'true' ? 'Present' : formatDate(e.end)].filter(Boolean).join(' – ');
  return (
    <aside aria-label="CV preview" className="card h-fit lg:sticky lg:top-24">
      <h3 className="mb-4 text-base font-semibold">📄 PDF Preview</h3>
      <div className="min-h-[320px] overflow-hidden break-words rounded-sm border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <p className="text-xl font-bold">{p.name || 'Your Name'}</p>
        {contact.length > 0 && <p className="mt-1 text-xs text-slate-600">{contact.join(' • ')}</p>}
        {draft.summary && <PSection title="Summary"><p>{draft.summary}</p></PSection>}
        {draft.experience.length > 0 && (
          <PSection title="Experience">
            {draft.experience.map((e) => (
              <div key={e.id} className="mb-2">
                <p className="font-semibold">{e.title || 'Role'}</p>
                <p className="text-xs text-slate-600">{[e.company, range(e)].filter(Boolean).join(' • ')}</p>
                {e.description && <p className="mt-0.5">{e.description}</p>}
              </div>
            ))}
          </PSection>
        )}
        {draft.education.length > 0 && (
          <PSection title="Education">
            {draft.education.map((e) => (
              <div key={e.id} className="mb-2">
                <p className="font-semibold">{e.degree || 'Degree'}</p>
                <p className="text-xs text-slate-600">{[e.school, range(e)].filter(Boolean).join(' • ')}</p>
              </div>
            ))}
          </PSection>
        )}
        {draft.skills.length > 0 && <PSection title="Skills"><p>{draft.skills.join(', ')}</p></PSection>}
        {draft.certifications.length > 0 && (
          <PSection title="Certifications">
            {draft.certifications.map((c) => (
              <p key={c.id}>{[c.name, c.issuer, formatDate(c.date)].filter(Boolean).join(' • ') || 'Certification'}</p>
            ))}
          </PSection>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-600">Live preview updates as you edit. PDF export arrives in a later release.</p>
    </aside>
  );
}

function PSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-1 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-brand">{title}</p>
      {children}
    </div>
  );
}
