import type { ReactNode } from 'react';
import type { CvDraft, Entry } from '../../types/cvDraft';
import { formatDate } from '../../utils/dates';
import { isOtherKind, OTHER_KIND_ORDER, OTHER_KINDS } from '../../utils/otherKinds';
import type { GroupKey } from './CanvasGroup';
import './CvTemplate.css';

const range = (e: Entry) =>
  [formatDate(e.start), e.current === 'true' ? 'Present' : formatDate(e.end)].filter(Boolean).join(' – ');

/** "Others" items grouped under one heading per kind; custom items under their own section title. */
function otherGroups(others: Entry[]) {
  const groups = new Map<string, { kind: string; items: Entry[] }>();
  for (const kind of OTHER_KIND_ORDER) {
    for (const e of others) {
      const k = isOtherKind(e.kind) ? e.kind : 'custom';
      if (k !== kind) continue;
      const title = k === 'custom' ? e.section?.trim() || 'Other' : OTHER_KINDS[k].label;
      const g = groups.get(title) ?? { kind: k, items: [] };
      g.items.push(e);
      groups.set(title, g);
    }
  }
  return [...groups].map(([title, g]) => ({ title, ...g }));
}

/** Text from the canvas: lines starting with "•" become a bullet list, the rest stay paragraphs. */
function Body({ text }: { text?: string }) {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={blocks.length} className="cvt-bullets">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  for (const line of lines) {
    if (/^[•\-*]\s*/.test(line)) bullets.push(line.replace(/^[•\-*]\s*/, ''));
    else {
      flush();
      blocks.push(<p key={blocks.length} className="cvt-text">{line}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function Section({ title, group, children }: { title: string; group: GroupKey; children: ReactNode }) {
  return (
    <section className="cvt-section" data-group={group}>
      <h2 className="cvt-heading">{title}</h2>
      {children}
    </section>
  );
}

function EntryRow({ title, sub, dates, body }: { title: string; sub?: string; dates?: string; body?: string }) {
  return (
    <div className="cvt-entry">
      <div className="cvt-entry-head">
        <span className="cvt-entry-title">{title}</span>
        {dates && <span className="cvt-entry-dates">{dates}</span>}
      </div>
      {sub && <div className="cvt-entry-sub">{sub}</div>}
      <Body text={body} />
    </div>
  );
}

const join = (parts: (string | undefined)[], sep = ', ') => parts.map((p) => p?.trim()).filter(Boolean).join(sep);

/** The CV as it will be printed: the "Classic" template (one column, ATS-readable). */
export function CvTemplate({ draft }: { draft: CvDraft }) {
  const p = draft.personal;
  const contact = [p.email, p.phone, p.location, p.linkedin, p.portfolio].filter((c) => c?.trim());
  return (
    <article className="cvt-page" aria-label="CV">
      <header data-group="personal">
        <h1 className={`cvt-name ${p.name ? '' : 'cvt-placeholder'}`}>{p.name || 'Your Name'}</h1>
        {p.headline && <p className="cvt-headline">{p.headline}</p>}
        {contact.length > 0 && (
          <p className="cvt-contact">
            {contact.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </p>
        )}
        <hr className="cvt-rule" />
      </header>

      {draft.summary.trim() && (
        <Section title="Summary" group="professional">
          <Body text={draft.summary} />
        </Section>
      )}
      {draft.experience.length > 0 && (
        <Section title="Experience" group="professional">
          {draft.experience.map((e) => (
            <EntryRow key={e.id} title={e.title || 'Role'} sub={e.company} dates={range(e)} body={e.description} />
          ))}
        </Section>
      )}
      {draft.projects.length > 0 && (
        <Section title="Projects" group="professional">
          {draft.projects.map((e) => (
            <EntryRow key={e.id} title={e.name || 'Project'} sub={e.url} dates={range(e)} body={e.description} />
          ))}
        </Section>
      )}
      {draft.education.length > 0 && (
        <Section title="Education" group="education">
          {draft.education.map((e) => (
            <EntryRow key={e.id} title={e.degree || 'Degree'} sub={join([e.school, e.score], ' · ')} dates={range(e)} />
          ))}
        </Section>
      )}
      {draft.skills.length > 0 && (
        <Section title="Skills" group="skills">
          <p className="cvt-inline">{draft.skills.join(', ')}</p>
        </Section>
      )}
      {draft.certifications.length > 0 && (
        <Section title="Certifications" group="skills">
          {draft.certifications.map((c) => (
            <EntryRow key={c.id} title={c.name || 'Certification'} sub={c.issuer} dates={formatDate(c.date)} />
          ))}
        </Section>
      )}
      {otherGroups(draft.others).map((g) => (
        <Section key={g.title} title={g.title} group="others">
          {g.kind === 'language' || g.kind === 'interest' ? (
            // short items read best on one line
            <p className="cvt-inline">
              {g.items.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ' · '}
                  {e.title || OTHER_KINDS[g.kind as 'language'].title}
                  {e.detail && <> (<span>{e.detail}</span>)</>}
                </span>
              ))}
            </p>
          ) : (
            g.items.map((e) => (
              <EntryRow key={e.id} title={e.title || 'Item'} sub={e.detail} dates={range(e)} body={e.description} />
            ))
          )}
        </Section>
      ))}
    </article>
  );
}
