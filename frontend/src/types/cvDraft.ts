// Local-only editing state for the Canvas (backend wiring arrives in Week 5; not part of the API contract).
export type PersonalInfo = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
};
export type Entry = { id: string; [field: string]: string };
export type CvDraft = {
  personal: PersonalInfo;
  summary: string;
  experience: Entry[];
  education: Entry[];
  skills: string[];
  certifications: Entry[];
};
