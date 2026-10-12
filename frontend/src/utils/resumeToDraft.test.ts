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
    expect(d.experience[0]).toMatchObject({ title: 'Analyst', company: 'Acme', start: '2019-03', end: '', description: 'Dashboards.\n• Cut costs 10%' });
    // year-only dates are left blank instead of inventing a month
    expect(d.education[0]).toMatchObject({ degree: 'BSc Maths', school: 'Leeds', start: '', end: '2018-06' });
    expect(d.skills).toEqual(['Python', 'pandas', 'SQL']);
    expect(d.certifications[0]).toMatchObject({ name: 'AWS SA', issuer: 'AWS', date: '2022-01' });
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
});
