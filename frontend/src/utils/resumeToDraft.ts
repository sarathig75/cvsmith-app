import type { JsonResume } from '../types';
import type { CvDraft, Entry } from '../types/cvDraft';
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

/** Converts parsed JSON Resume data into the canvas draft shape. */
export function resumeToDraft(resume: JsonResume): CvDraft {
  const b = resume.basics ?? {};
  const linkedin = b.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url ?? '';
  return {
    personal: {
      name: b.name ?? '',
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
        end: toDate(w.endDate),
        yearOnly: yearOnlyFlag(w.startDate, w.endDate),
        description: join([w.summary, ...(w.highlights ?? []).map((h) => `• ${h}`)], '\n'),
      }),
    ),
    education: (resume.education ?? []).map((e) =>
      entry({
        degree: join([e.studyType, e.area], ' '),
        school: e.institution ?? '',
        start: toDate(e.startDate),
        end: toDate(e.endDate),
        yearOnly: yearOnlyFlag(e.startDate, e.endDate),
      }),
    ),
    skills: dedupe((resume.skills ?? []).flatMap((s) => [s.name ?? '', ...(s.keywords ?? [])])),
    certifications: (resume.certificates ?? []).map((c) =>
      entry({ name: c.name ?? '', issuer: c.issuer ?? '', date: toDate(c.date), yearOnly: yearOnlyFlag(c.date) }),
    ),
  };
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

/**
 * Fills the user's draft from parsed data without overwriting anything they typed:
 * a text field is filled only if it is empty, a list only if it has no entries.
 * The email field starts pre-filled with the account email; that default is not the user's
 * own input, so an email found on the CV replaces it (people often use a different address
 * for job applications). An email the user typed themselves is kept.
 */
export function mergeParsedIntoDraft(current: CvDraft, parsed: CvDraft, accountEmail = ''): CvDraft {
  const personal = { ...current.personal };
  for (const key of Object.keys(personal) as (keyof typeof personal)[]) {
    const untouchedDefault = key === 'email' && !!accountEmail && personal.email.trim().toLowerCase() === accountEmail.toLowerCase();
    if ((!personal[key].trim() || untouchedDefault) && parsed.personal[key]) personal[key] = parsed.personal[key];
  }
  return {
    personal,
    summary: current.summary.trim() ? current.summary : parsed.summary,
    experience: current.experience.length ? current.experience : parsed.experience,
    education: current.education.length ? current.education : parsed.education,
    skills: current.skills.length ? current.skills : parsed.skills,
    certifications: current.certifications.length ? current.certifications : parsed.certifications,
  };
}
