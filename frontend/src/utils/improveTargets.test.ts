import { improveTargets } from './improveTargets';
import { emptyDraft } from '../types/cvDraft';
import type { CvDraft } from '../types/cvDraft';

const draft = (over: Partial<CvDraft> = {}): CvDraft => ({ ...emptyDraft('a@b.co'), ...over });

describe('improveTargets', () => {
  it('asks for descriptions first, then the summary, then the headline', () => {
    const targets = improveTargets(
      draft({
        summary: 'A summary.',
        experience: [
          { id: 'e1', title: 'Analyst', company: 'Acme', description: '• Did things' },
          { id: 'e2', title: 'Intern', company: 'Beta', description: '• Did other things' },
        ],
        projects: [{ id: 'p1', name: 'Churn model', description: '• Built a model' }],
      }),
    );
    expect(targets.map((t) => t.request.field)).toEqual(['experience', 'experience', 'projects', 'summary', 'headline']);
    expect(targets[0]).toMatchObject({
      label: 'Work experience: Analyst at Acme',
      request: { entry_id: 'e1', text: '• Did things', context: { title: 'Analyst', company: 'Acme' } },
    });
    expect(targets[2].label).toBe('Project: Churn model');
  });

  it('leaves out entries with no description', () => {
    const targets = improveTargets(
      draft({ experience: [{ id: 'e1', title: 'Analyst', company: 'Acme', description: '  ' }, { id: 'e2', title: 'B', company: 'C', description: 'x' }] }),
    );
    expect(targets.filter((t) => t.request.field === 'experience').map((t) => t.request.entry_id)).toEqual(['e2']);
  });

  it('includes an empty summary and headline when there is something to write them from', () => {
    const targets = improveTargets(draft({ experience: [{ id: 'e1', title: 'Analyst', company: 'Acme', description: '' }] }));
    expect(targets.map((t) => t.request.field)).toEqual(['summary', 'headline']);
  });

  it('has nothing to do for an empty CV', () => {
    expect(improveTargets(draft())).toEqual([]);
  });
});
