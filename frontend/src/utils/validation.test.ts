import { MAX_CV_BYTES, passwordStrength, validateCvFile, validateEmail, validatePassword } from './validation';

const f = (name: string, size = 1000, type = '') => ({ name, size, type });

describe('validateCvFile', () => {
  it('accepts PDF and DOCX', () => {
    expect(validateCvFile(f('cv.pdf', 1000, 'application/pdf')).ok).toBe(true);
    expect(validateCvFile(f('CV.DOCX', 1000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).ok).toBe(true);
  });
  it('accepts DOCX when the browser reports no MIME type', () => {
    expect(validateCvFile(f('cv.docx')).ok).toBe(true);
  });
  it('rejects other extensions, legacy .doc and mismatched MIME', () => {
    expect(validateCvFile(f('cv.txt', 10, 'text/plain')).ok).toBe(false);
    expect(validateCvFile(f('cv.doc')).ok).toBe(false);
    expect(validateCvFile(f('noext')).ok).toBe(false);
    expect(validateCvFile(f('cv.pdf', 10, 'image/png')).ok).toBe(false);
  });
  it('enforces the 10MB limit inclusively and rejects empty files', () => {
    expect(validateCvFile(f('cv.pdf', MAX_CV_BYTES)).ok).toBe(true);
    const big = validateCvFile(f('cv.pdf', MAX_CV_BYTES + 1));
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.message).toMatch(/10MB/);
    expect(validateCvFile(f('cv.pdf', 0)).ok).toBe(false);
  });
});

describe('credentials validation', () => {
  it('validates email', () => {
    expect(validateEmail('')).toMatch(/required/i);
    expect(validateEmail('nope')).toMatch(/valid/i);
    expect(validateEmail(' a@b.co ')).toBeNull();
  });
  it('applies the contract password rule', () => {
    expect(validatePassword('short1')).not.toBeNull();
    expect(validatePassword('allletters')).not.toBeNull();
    expect(validatePassword('12345678')).not.toBeNull();
    expect(validatePassword('abcdefg1')).toBeNull();
  });
  it('rates strength', () => {
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('abcdefg1')).toBe('fair');
    expect(passwordStrength('Abcdefghij12!')).toBe('strong');
  });
});
