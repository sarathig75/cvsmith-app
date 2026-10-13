// Mirrors docs/API_CONTRACT.md exactly.
export type User = {
  id: string;
  email: string;
  email_verified: boolean;
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
  parsing_status: 'pending' | 'in_progress' | 'complete' | 'failed';
  parsing_error: string | null;
  json_resume: JsonResume;
  created_at: string;
};

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
  | 'SERVER_ERROR';

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

export type Credentials = { email: string; password: string };
