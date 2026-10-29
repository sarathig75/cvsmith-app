// Mirrors docs/API_CONTRACT.md exactly.
export type User = {
  id: string;
  email: string;
  email_verified: boolean;
  /** No payments in Release 1: everyone is "free" until Pro is sold. */
  plan: 'free' | 'pro';
  created_at: string;
};

export type Token = {
  access_token: string;
  token_type: 'bearer';
  user: User;
};

export type CV = {
  id: string;
  title: string;
  privacy: 'private' | 'public';
  /** "not_uploaded": the CV was created by saving the canvas, without a file. */
  parsing_status: 'not_uploaded' | 'pending' | 'in_progress' | 'complete' | 'failed';
  parsing_error: string | null;
  /** Parsing runs in three parts; each part's data appears in json_resume as soon as it is "complete". */
  /** `contact` is absent on CVs parsed before it existed. */
  parsing_parts: Record<Exclude<ParsePart, 'contact'>, PartStatus> & { contact?: PartStatus };
  /** Parser output only. */
  json_resume: JsonResume;
  /** The user's canvas as last saved (PATCH /api/cv); null until the first save. */
  content: Record<string, unknown> | null;
  /** Parsed parts already merged into `content`. */
  applied_parts: ParsePart[];
  content_updated_at: string | null;
  created_at: string;
};

export type CVSave = { content: Record<string, unknown>; applied_parts: ParsePart[]; edited?: boolean };

/** "contact": email, phone and LinkedIn found by pattern (instant, no AI); the others are AI parts. */
export type ParsePart = 'contact' | 'basics' | 'experience' | 'extras';
export type PartStatus = 'pending' | 'complete' | 'failed';

/** The JSON Resume subset the backend fills when parsing completes ({} before that). Every field is optional. */
export type JsonResume = {
  basics?: {
    name?: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: { city?: string; region?: string; countryCode?: string };
    profiles?: { network?: string; url?: string; username?: string }[];
  };
  work?: {
    name?: string;
    position?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean; // CVSmith extension: true only when the CV says the role is ongoing
    summary?: string;
    highlights?: string[];
  }[];
  education?: { institution?: string; area?: string; studyType?: string; startDate?: string; endDate?: string; score?: string }[];
  skills?: { name?: string; keywords?: string[] }[];
  certificates?: { name?: string; issuer?: string; date?: string; url?: string }[];
  languages?: { language?: string; fluency?: string }[];
  awards?: { title?: string; awarder?: string; date?: string; summary?: string }[];
  volunteer?: {
    organization?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
  }[];
  projects?: { name?: string; description?: string; startDate?: string; endDate?: string; url?: string; highlights?: string[] }[];
  interests?: { name?: string; keywords?: string[] }[];
};

/** CV fields that can get an AI suggestion (💡 Improve). */
export type SuggestionField = 'summary' | 'experience' | 'projects' | 'headline';

export type Suggestion = {
  id: string;
  field: SuggestionField;
  /** The canvas entry (experience or project) the text came from; null for the summary. */
  entry_id: string | null;
  original: string;
  suggested: string;
  /** false: the text already followed the rules ("unchanged"); such results are not counted. */
  changed: boolean;
  status: 'pending' | 'accepted' | 'declined' | 'unchanged';
  created_at: string;
  /** Names in the suggestion that the CV does not contain (only on the create response). Not rejected:
   * the user is asked to add them to the CV first. */
  missing_details?: string[];
};

export type SuggestionRequest = {
  field: SuggestionField;
  entry_id?: string | null;
  text: string;
  context?: { title?: string; company?: string };
};

/** Suggestions per calendar month (UTC): free 1, pro 50. */
export type Quota = { plan: 'free' | 'pro'; limit: number; used: number; remaining: number; resets_at: string };

/** ATS format score (docs/ATS_FRAMEWORK.md). A check that does not apply is left out. */
export type AtsCheck = { id: string; label: string; passed: boolean; points: number; max: number; fix: string | null };
export type AtsScore = {
  score: number;
  checks: AtsCheck[];
  first_fix: { check_id: string; text: string; points: number } | null;
  framework: string;
};
/** before: the uploaded file; after: the saved CV as the Classic PDF. Either can be null. */
export type AtsPair = { before: AtsScore | null; after: AtsScore | null };

export type CvStrength = {
  percent: number;
  sections: { key: string; label: string; points: number; max: number; complete: boolean }[];
  next_step: { section: string; text: string; points: number } | null;
};
export type Dashboard = {
  state: 'no_cv' | 'parsing' | 'ready' | 'needs_details';
  cv_strength: CvStrength | null;
  ats: AtsScore | null;
  plan: 'free' | 'pro';
};

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'NOT_FOUND'
  | 'GOOGLE_AUTH_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'SUGGESTION_FAILED'
  | 'PRO_REQUIRED'
  | 'PDF_FAILED'
  | 'INVALID_CODE'
  | 'RATE_LIMITED'
  | 'EMAIL_FAILED'
  | 'NOT_INVITED'
  | 'SERVER_ERROR';

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

