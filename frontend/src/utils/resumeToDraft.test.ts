import { mergeParsedIntoDraft, resumeToDraft } from './resumeToDraft';
import { emptyDraft } from '../types/cvDraft';
import type { CvDraft } from '../types/cvDraft';

const resume = {
  basics: {
    name: 'Jane Doe',
    label: 'Data Analyst',
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

const empty = (): CvDraft => emptyDraft();

describe('resumeToDraft', () => {
  it('maps JSON Resume fields onto the canvas draft', () => {
    const d = resumeToDraft(resume);
    expect(d.personal).toEqual({
      name: 'Jane Doe',
      headline: 'Data Analyst',
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
    // a skill with keywords is a group: its keywords become tags, not its heading
    expect(d.skills).toEqual(['pandas', 'python', 'SQL']);
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

  it('marks roles the CV says are ongoing as current', () => {
    const d = resumeToDraft({
      work: [
        { name: 'Now Co', startDate: '2021', endDate: '2023', current: true },
        { name: 'Old Co', startDate: '2018-02' },
      ],
    });
    expect(d.experience[0]).toMatchObject({ start: '2021', end: '', current: 'true', yearOnly: 'true' });
    // no end date given is not the same as "current"
    expect(d.experience[1]).toMatchObject({ start: '2018-02', end: '', current: '' });
  });

  it('drops dates it cannot understand rather than guessing', () => {
    const d = resumeToDraft({ work: [{ name: 'Acme', startDate: 'Spring', endDate: '2018-13' }] });
    expect(d.experience[0]).toMatchObject({ start: '', end: '2018', yearOnly: 'true' });
  });

  it('maps projects, education scores and the "Others" sections', () => {
    const d = resumeToDraft({
      education: [{ institution: 'SSN', studyType: 'BE', score: 'CGPA 6.1' }],
      projects: [{ name: 'Portfolio', url: 'https://x.dev', startDate: '2023', description: 'Site.', highlights: ['React'] }],
      languages: [{ language: 'Tamil', fluency: 'Native' }],
      awards: [{ title: 'Employee of the month', awarder: 'Acme', date: '2018-08' }],
      volunteer: [{ position: 'Sponsorship head', organization: 'College fest', startDate: '2017', endDate: '2018' }],
      interests: [{ name: 'Chess' }],
    });
    expect(d.education[0]).toMatchObject({ score: 'CGPA 6.1' });
    expect(d.projects[0]).toMatchObject({ name: 'Portfolio', url: 'https://x.dev', start: '2023', yearOnly: 'true', description: 'Site.\n• React' });
    expect(d.others.map((o) => [o.kind, o.title, o.detail])).toEqual([
      ['language', 'Tamil', 'Native'],
      ['award', 'Employee of the month', 'Acme'],
      ['volunteer', 'Sponsorship head', 'College fest'],
      ['interest', 'Chess', ''],
    ]);
    expect(d.others[1]).toMatchObject({ start: '2018-08', yearOnly: '' });
    expect(d.others[2]).toMatchObject({ start: '2017', end: '2018', yearOnly: 'true' });
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
