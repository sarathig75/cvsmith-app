import type { JsonResume } from '../types';
import type { CvDraft, Entry } from '../types/cvDraft';

/** Month inputs need YYYY-MM. A year-only date is left blank rather than inventing a month. */
const toMonth = (date?: string) => (date && /^\d{4}-\d{2}$/.test(date) ? date : '');

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
        start: toMonth(w.startDate),
        end: toMonth(w.endDate),
        description: join([w.summary, ...(w.highlights ?? []).map((h) => `• ${h}`)], '\n'),
      }),
    ),
    education: (resume.education ?? []).map((e) =>
      entry({
        degree: join([e.studyType, e.area], ' '),
        school: e.institution ?? '',
        start: toMonth(e.startDate),
        end: toMonth(e.endDate),
      }),
    ),
    skills: dedupe((resume.skills ?? []).flatMap((s) => [s.name ?? '', ...(s.keywords ?? [])])),
    certifications: (resume.certificates ?? []).map((c) =>
      entry({ name: c.name ?? '', issuer: c.issuer ?? '', date: toMonth(c.date) }),
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
 */
export function mergeParsedIntoDraft(current: CvDraft, parsed: CvDraft): CvDraft {
  const personal = { ...current.personal };
  for (const key of Object.keys(personal) as (keyof typeof personal)[]) {
    if (!personal[key].trim() && parsed.personal[key]) personal[key] = parsed.personal[key];
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
