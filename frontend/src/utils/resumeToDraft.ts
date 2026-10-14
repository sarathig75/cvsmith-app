import type { JsonResume, ParsePart } from '../types';
import type { CvDraft, Entry, OtherKind } from '../types/cvDraft';
import { composeDate, isYearOnly, parseDate } from './dates';

/** Keep "YYYY-MM" or "YYYY" as given (never invent a month); anything else becomes blank. */
const toDate = (date?: string) => composeDate(parseDate(date));

/** Tick "Years only" when every date the CV gives for this entry is year-only. */
const yearOnlyFlag = (...dates: (string | undefined)[]) => {
  const given = dates.map(toDate).filter(Boolean);
  return given.length > 0 && given.every(isYearOnly) ? 'true' : '';
};

const join = (parts: (string | undefined)[], sep: string) => parts.map((p) => p?.trim()).filter(Boolean).join(sep);

const entry = (fields: Record<string, string>): Entry => ({ id: crypto.randomUUID(), ...fields });

const bullets = (summary: string | undefined, highlights: string[] | undefined) =>
  join([summary, ...(highlights ?? []).map((h) => `• ${h}`)], '\n');

const other = (kind: OtherKind, fields: Record<string, string>) =>
  entry({ kind, section: '', title: '', detail: '', start: '', end: '', description: '', yearOnly: '', ...fields });

/** Converts parsed JSON Resume data into the canvas draft shape. */
export function resumeToDraft(resume: JsonResume): CvDraft {
  const b = resume.basics ?? {};
  const linkedin = b.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url ?? '';
  return {
    personal: {
      name: b.name ?? '',
      headline: b.label ?? '',
      email: b.email ?? '',
      phone: b.phone ?? '',
      location: join([b.location?.city, b.location?.region, b.location?.countryCode], ', '),
      linkedin,
      portfolio: b.url ?? '',
    },
    summary: b.summary ?? '',
    experience: (resume.work ?? []).map((w) =>
      entry({
        title: w.position ?? '',
        company: w.name ?? '',
        start: toDate(w.startDate),
        end: w.current ? '' : toDate(w.endDate),
        current: w.current ? 'true' : '',
        yearOnly: yearOnlyFlag(w.startDate, w.current ? undefined : w.endDate),
        description: bullets(w.summary, w.highlights),
      }),
    ),
    projects: (resume.projects ?? []).map((p) =>
      entry({
        name: p.name ?? '',
        url: p.url ?? '',
        start: toDate(p.startDate),
        end: toDate(p.endDate),
        yearOnly: yearOnlyFlag(p.startDate, p.endDate),
        description: bullets(p.description, p.highlights),
      }),
    ),
    education: (resume.education ?? []).map((e) =>
      entry({
        degree: join([e.studyType, e.area], ' '),
        school: e.institution ?? '',
        start: toDate(e.startDate),
        end: toDate(e.endDate),
        score: e.score ?? '',
        yearOnly: yearOnlyFlag(e.startDate, e.endDate),
      }),
    ),
    // A skill with keywords is a group ("Core Competencies: ..."): its keywords are the skills,
    // the group name is only a heading, so it does not become a tag of its own.
    skills: dedupe((resume.skills ?? []).flatMap((s) => (s.keywords?.length ? s.keywords : [s.name ?? '']))),
    certifications: (resume.certificates ?? []).map((c) =>
      entry({ name: c.name ?? '', issuer: c.issuer ?? '', date: toDate(c.date), yearOnly: yearOnlyFlag(c.date) }),
    ),
    others: [
      ...(resume.languages ?? []).map((l) => other('language', { title: l.language ?? '', detail: l.fluency ?? '' })),
      ...(resume.awards ?? []).map((a) =>
        other('award', {
          title: a.title ?? '',
          detail: a.awarder ?? '',
          start: toDate(a.date),
          yearOnly: yearOnlyFlag(a.date),
          description: a.summary ?? '',
        }),
      ),
      ...(resume.volunteer ?? []).map((v) =>
        other('volunteer', {
          title: v.position ?? '',
          detail: v.organization ?? '',
          start: toDate(v.startDate),
          end: toDate(v.endDate),
          yearOnly: yearOnlyFlag(v.startDate, v.endDate),
          description: bullets(v.summary, v.highlights),
        }),
      ),
      ...(resume.interests ?? []).map((i) => other('interest', { title: i.name ?? '', detail: join(i.keywords ?? [], ', ') })),
    ],
  };
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

/** Canvas sections filled by each parsing part (see parsing_parts in docs/API_CONTRACT.md). */
export const PART_SECTIONS: Record<ParsePart, (keyof CvDraft)[]> = {
  // contact fills email/phone/LinkedIn within a second; basics adds name, headline and location
  // (filling only fields still empty, so the two never fight).
  contact: ['personal'],
  basics: ['personal'],
  experience: ['summary', 'experience', 'education'],
  extras: ['projects', 'skills', 'certifications', 'others'],
};

/**
 * Fills the user's draft from parsed data without overwriting anything they typed:
 * a text field is filled only if it is empty, a list only if it has no entries.
 * The email field starts pre-filled with the account email; that default is not the user's
 * own input, so an email found on the CV replaces it (people often use a different address
 * for job applications). An email the user typed themselves is kept.
 * With `sections`, only those sections are filled (parsing results arrive part by part).
 */
export function mergeParsedIntoDraft(
  current: CvDraft,
  parsed: CvDraft,
  accountEmail = '',
  sections?: (keyof CvDraft)[],
): CvDraft {
  const merged = mergeAll(current, parsed, accountEmail);
  if (!sections) return merged;
  const result = { ...current };
  for (const key of sections) (result as Record<keyof CvDraft, unknown>)[key] = merged[key];
  return result;
}

function mergeAll(current: CvDraft, parsed: CvDraft, accountEmail: string): CvDraft {
  const personal = { ...current.personal };
  for (const key of Object.keys(personal) as (keyof typeof personal)[]) {
    const untouchedDefault = key === 'email' && !!accountEmail && personal.email.trim().toLowerCase() === accountEmail.toLowerCase();
    if ((!personal[key].trim() || untouchedDefault) && parsed.personal[key]) personal[key] = parsed.personal[key];
  }
  return {
    personal,
    summary: current.summary.trim() ? current.summary : parsed.summary,
    experience: current.experience.length ? current.experience : parsed.experience,
    projects: current.projects.length ? current.projects : parsed.projects,
    education: current.education.length ? current.education : parsed.education,
    skills: current.skills.length ? current.skills : parsed.skills,
    certifications: current.certifications.length ? current.certifications : parsed.certifications,
    others: current.others.length ? current.others : parsed.others,
  };
}
