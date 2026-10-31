import { undoDates, yearOnlyDates } from './dateFix';
import { emptyDraft } from '../types/cvDraft';
import type { CvDraft } from '../types/cvDraft';

const draft: CvDraft = {
  ...emptyDraft('a@b.co'),
  experience: [
    { id: 'e1', title: 'A', start: '2019-03', end: '2021-06', yearOnly: '' },
    { id: 'e2', title: 'B', start: '2015', end: '2019', yearOnly: 'true' },
    { id: 'e3', title: 'Blank', start: '', end: '' },
  ],
  education: [{ id: 'd1', degree: 'BSc', start: '2010-09', end: '2014' }],
  certifications: [{ id: 'c1', name: 'X', date: '2020-05' }],
  projects: [{ id: 'p1', name: 'P', start: '', end: '' }],
};

describe('yearOnlyDates', () => {
  it('shows every date as the year only and ticks "Years only" on the entries it changed', () => {
    const { draft: out, changed } = yearOnlyDates(draft);
    expect(changed).toBe(true);
    expect(out.experience[0]).toMatchObject({ start: '2019', end: '2021', yearOnly: 'true' });
    expect(out.education[0]).toMatchObject({ start: '2010', end: '2014', yearOnly: 'true' });
    expect(out.certifications[0]).toMatchObject({ date: '2020', yearOnly: 'true' });
  });

  it('leaves entries that are already year-only, and entries with no dates, alone', () => {
    const { draft: out } = yearOnlyDates(draft);
    expect(out.experience[1]).toBe(draft.experience[1]);
    expect(out.experience[2]).toBe(draft.experience[2]);
    expect(out.projects[0]).toBe(draft.projects[0]);
  });

  it('changes nothing when every date is already the year only', () => {
    const once = yearOnlyDates(draft).draft;
    const again = yearOnlyDates(once);
    expect(again.changed).toBe(false);
    expect(again.undo).toEqual([]);
  });

  it('can be undone, keeping later edits', () => {
    const { draft: out, undo } = yearOnlyDates(draft);
    const edited = { ...out, experience: out.experience.map((e) => (e.id === 'e1' ? { ...e, title: 'A renamed' } : e)) };
    const back = undoDates(edited, undo);
    expect(back.experience[0]).toMatchObject({ title: 'A renamed', start: '2019-03', end: '2021-06', yearOnly: '' });
    expect(back.education[0]).toMatchObject({ start: '2010-09', end: '2014' });
    expect(back.certifications[0].date).toBe('2020-05');
  });

  it('skips an entry that was deleted before the undo', () => {
    const { draft: out, undo } = yearOnlyDates(draft);
    const deleted = { ...out, experience: out.experience.filter((e) => e.id !== 'e1') };
    expect(() => undoDates(deleted, undo)).not.toThrow();
  });
});
