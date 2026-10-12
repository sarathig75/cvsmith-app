export const MAX_CV_BYTES = 10 * 1024 * 1024;
export const ALLOWED_CV_EXTENSIONS = ['pdf', 'docx'] as const;
const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export type FileValidation = { ok: true } | { ok: false; message: string };

/** Client-side check mirroring the backend rules: PDF/DOCX, non-empty, max 10MB. */
export function validateCvFile(file: Pick<File, 'name' | 'size' | 'type'>): FileValidation {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const extOk = (ALLOWED_CV_EXTENSIONS as readonly string[]).includes(ext);
  // Some browsers leave type empty for DOCX; only reject a type that is present and wrong.
  const mimeOk = file.type === '' || ALLOWED_MIME.includes(file.type);
  if (!extOk || !mimeOk) {
    return { ok: false, message: 'Unsupported file type. Please upload a PDF or Word (.docx) file.' };
  }
  if (file.size === 0) return { ok: false, message: 'This file is empty.' };
  if (file.size > MAX_CV_BYTES) {
    return { ok: false, message: 'File is too large. The maximum size is 10MB.' };
  }
  return { ok: true };
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
  return null;
}

export type PasswordRule = { id: 'length' | 'letter' | 'number'; label: string; met: boolean };

/** Contract rule: min 8 chars, at least 1 letter and 1 number. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'letter', label: 'At least 1 letter', met: /[A-Za-z]/.test(password) },
    { id: 'number', label: 'At least 1 number', met: /\d/.test(password) },
  ];
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  const unmet = passwordRules(password).filter((r) => !r.met);
  if (unmet.length) return 'Password must be at least 8 characters and include a letter and a number.';
  return null;
}

export type Strength = 'weak' | 'fair' | 'strong';
export function passwordStrength(password: string): Strength {
  const met = passwordRules(password).every((r) => r.met);
  if (!met) return 'weak';
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  return password.length >= 12 && variety >= 3 ? 'strong' : 'fair';
}
