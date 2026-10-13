import { mergeParsedIntoDraft, resumeToDraft } from './resumeToDraft';
import type { CvDraft } from '../types/cvDraft';

const resume = {
  basics: {
    name: 'Jane Doe',
    email: 'jane@cv.com',
    phone: '+44 1234',
    url: 'https://jane.dev',
    summary: 'Analyst.',
    location: { city: 'Leeds', countryCode: 'GB' },
    profiles: [{ network: 'LinkedIn', url: 'https://linkedin.com/in/jane' }],
  },
  work: [{ name: 'Acme', position: 'Analyst', startDate: '2019-03', summary: 'Dashboards.', highlights: ['Cut costs 10%'] }],
  education: [{ institution: 'Leeds', studyType: 'BSc', area: 'Maths', startDate: '2015', endDate: '2018-06' }],
  skills: [{ name: 'Python', keywords: ['pandas', 'python'] }, { name: 'SQL' }],
  certificates: [{ name: 'AWS SA', issuer: 'AWS', date: '2022-01' }],
};

const empty = (): CvDraft => ({
  personal: { name: '', email: '', phone: '', location: '', linkedin: '', portfolio: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  certifications: [],
});

describe('resumeToDraft', () => {
  it('maps JSON Resume fields onto the canvas draft', () => {
    const d = resumeToDraft(resume);
    expect(d.personal).toEqual({
      name: 'Jane Doe',
      email: 'jane@cv.com',
      phone: '+44 1234',
      location: 'Leeds, GB',
      linkedin: 'https://linkedin.com/in/jane',
      portfolio: 'https://jane.dev',
    });
    expect(d.summary).toBe('Analyst.');
    expect(d.experience[0]).toMatchObject({
      title: 'Analyst', company: 'Acme', start: '2019-03', end: '', yearOnly: '', description: 'Dashboards.\n• Cut costs 10%',
    });
    // mixed precision: the year-only date is kept as a year, months stay visible
    expect(d.education[0]).toMatchObject({ degree: 'BSc Maths', school: 'Leeds', start: '2015', end: '2018-06', yearOnly: '' });
    expect(d.skills).toEqual(['Python', 'pandas', 'SQL']);
    expect(d.certifications[0]).toMatchObject({ name: 'AWS SA', issuer: 'AWS', date: '2022-01' });
  });

  it('ticks "Years only" when the CV gives only years, without inventing months', () => {
    const d = resumeToDraft({
      work: [{ name: 'Acme', startDate: '2015', endDate: '2018' }],
      certificates: [{ name: 'PMP', date: '2020' }],
    });
    expect(d.experience[0]).toMatchObject({ start: '2015', end: '2018', yearOnly: 'true' });
    expect(d.certifications[0]).toMatchObject({ date: '2020', yearOnly: 'true' });
  });

  it('drops dates it cannot understand rather than guessing', () => {
    const d = resumeToDraft({ work: [{ name: 'Acme', startDate: 'Spring', endDate: '2018-13' }] });
    expect(d.experience[0]).toMatchObject({ start: '', end: '2018', yearOnly: 'true' });
  });

  it('copes with an empty or partial result', () => {
    expect(resumeToDraft({})).toEqual(empty());
  });
});

describe('mergeParsedIntoDraft', () => {
  it('fills only empty fields and empty lists, never overwriting user input', () => {
    const current = empty();
    current.personal.name = 'Jane D. (typed)';
    current.skills = ['Typed skill'];
    const merged = mergeParsedIntoDraft(current, resumeToDraft(resume));
    expect(merged.personal.name).toBe('Jane D. (typed)');
    expect(merged.personal.phone).toBe('+44 1234');
    expect(merged.skills).toEqual(['Typed skill']);
    expect(merged.experience).toHaveLength(1);
    expect(merged.summary).toBe('Analyst.');
  });

  it('replaces the pre-filled account email with the email from the CV', () => {
    const current = empty();
    current.personal.email = 'Login@Example.com';
    expect(mergeParsedIntoDraft(current, resumeToDraft(resume), 'login@example.com').personal.email).toBe('jane@cv.com');
  });

  it('keeps an email the user typed themselves', () => {
    const current = empty();
    current.personal.email = 'typed@me.com';
    expect(mergeParsedIntoDraft(current, resumeToDraft(resume), 'login@example.com').personal.email).toBe('typed@me.com');
  });

  it('keeps the account email when the CV has none', () => {
    const current = empty();
    current.personal.email = 'login@example.com';
    expect(mergeParsedIntoDraft(current, resumeToDraft({}), 'login@example.com').personal.email).toBe('login@example.com');
  });
});
