import type { CvDraft, Entry } from '../../types/cvDraft';
import { formatDate } from '../../utils/dates';
import { isOtherKind, OTHER_KIND_ORDER, OTHER_KINDS } from '../../utils/otherKinds';

const range = (e: Entry) =>
  [formatDate(e.start), e.current === 'true' ? 'Present' : formatDate(e.end)].filter(Boolean).join(' – ');

/** "Others" items grouped under one heading per kind; custom items under their own section title. */
function otherGroups(others: Entry[]): { title: string; items: Entry[] }[] {
  const groups = new Map<string, Entry[]>();
  for (const kind of OTHER_KIND_ORDER) {
    for (const e of others) {
      const k = isOtherKind(e.kind) ? e.kind : 'custom';
      if (k !== kind) continue;
      const title = k === 'custom' ? e.section?.trim() || 'Other' : OTHER_KINDS[k].label;
      groups.set(title, [...(groups.get(title) ?? []), e]);
    }
  }
  return [...groups].map(([title, items]) => ({ title, items }));
}

export function PreviewPanel({ draft }: { draft: CvDraft }) {
  const p = draft.personal;
  const contact = [p.email, p.phone, p.location, p.linkedin, p.portfolio].filter(Boolean);
  return (
    <aside aria-label="CV preview" className="card h-fit lg:sticky lg:top-24">
      <h3 className="mb-4 text-base font-semibold">📄 PDF Preview</h3>
      <div className="min-h-[320px] overflow-hidden break-words rounded-sm border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <p className="text-xl font-bold">{p.name || 'Your Name'}</p>
        {p.headline && <p className="text-sm text-slate-700">{p.headline}</p>}
        {contact.length > 0 && <p className="mt-1 text-xs text-slate-600">{contact.join(' • ')}</p>}
        {draft.summary && <PSection title="Summary"><p className="whitespace-pre-line">{draft.summary}</p></PSection>}
        {draft.experience.length > 0 && (
          <PSection title="Experience">
            {draft.experience.map((e) => (
              <Item key={e.id} title={e.title || 'Role'} meta={[e.company, range(e)]} body={e.description} />
            ))}
          </PSection>
        )}
        {draft.projects.length > 0 && (
          <PSection title="Projects">
            {draft.projects.map((e) => (
              <Item key={e.id} title={e.name || 'Project'} meta={[e.url, range(e)]} body={e.description} />
            ))}
          </PSection>
        )}
        {draft.education.length > 0 && (
          <PSection title="Education">
            {draft.education.map((e) => (
              <Item key={e.id} title={e.degree || 'Degree'} meta={[e.school, range(e), e.score]} />
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
        {otherGroups(draft.others).map((g) => (
          <PSection key={g.title} title={g.title}>
            {g.items.map((e) => (
              <Item key={e.id} title={e.title || 'Item'} meta={[e.detail, range(e)]} body={e.description} />
            ))}
          </PSection>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-600">Live preview updates as you edit. PDF export arrives in a later release.</p>
    </aside>
  );
}

function Item({ title, meta, body }: { title: string; meta: (string | undefined)[]; body?: string }) {
  const line = meta.filter(Boolean).join(' • ');
  return (
    <div className="mb-2">
      <p className="font-semibold">{title}</p>
      {line && <p className="text-xs text-slate-600">{line}</p>}
      {body && <p className="mt-0.5 whitespace-pre-line">{body}</p>}
    </div>
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
