// Local-only editing state for the Canvas (backend wiring arrives in Week 5; not part of the API contract).
export type PersonalInfo = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
};
export type Entry = { id: string; [field: string]: string };

/** Kinds of item in the "Others" group. Adding a kind is one entry in OTHER_KINDS, not a new section. */
export type OtherKind = 'language' | 'award' | 'volunteer' | 'interest' | 'custom';

export type CvDraft = {
  personal: PersonalInfo;
  summary: string;
  experience: Entry[];
  projects: Entry[];
  education: Entry[];
  skills: string[];
  certifications: Entry[];
  /** Entries with a `kind` (OtherKind); custom ones also carry their own `section` title. */
  others: Entry[];
};

export const emptyDraft = (email = ''): CvDraft => ({
  personal: { name: '', headline: '', email, phone: '', location: '', linkedin: '', portfolio: '' },
  summary: '',
  experience: [],
  projects: [],
  education: [],
  skills: [],
  certifications: [],
  others: [],
});

/** A saved canvas (CV.content), with any keys missing from older saves filled from the empty draft. */
export function draftFromSaved(content: Record<string, unknown>): CvDraft {
  const base = emptyDraft();
  const saved = content as Partial<CvDraft>;
  const list = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  return {
    personal: { ...base.personal, ...(saved.personal ?? {}) },
    summary: typeof saved.summary === 'string' ? saved.summary : '',
    experience: list(saved.experience),
    projects: list(saved.projects),
    education: list(saved.education),
    skills: list(saved.skills),
    certifications: list(saved.certifications),
    others: list(saved.others),
  };
}
