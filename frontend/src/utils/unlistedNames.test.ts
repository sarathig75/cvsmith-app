import { describe, expect, it } from 'vitest';
import { unlistedNames } from './unlistedNames';

const cv = { experience: [{ description: 'Built reports in Power BI for Northwind Logistics' }], skills: ['PPAP'] };

describe('unlistedNames', () => {
  it('lists capitalised words the rest of the CV does not contain', () => {
    expect(unlistedNames('Joined Contoso Ltd in 2019', cv)).toEqual(['Contoso', 'Ltd']);
    expect(unlistedNames('Used Tableau for Northwind Logistics', cv)).toEqual(['Tableau']);
  });
  it('accepts names the CV contains, in any case', () => {
    expect(unlistedNames('Built reports in Power BI for northwind logistics', cv)).toEqual([]);
  });
  it('skips the first word of a sentence or bullet', () => {
    expect(unlistedNames('Led the team. Delivered results. • Managed budgets', cv)).toEqual([]);
  });
  it('allows a spelled-out acronym the CV uses', () => {
    expect(unlistedNames('Prepared Production Part Approval Process (PPAP) documents', cv)).toEqual([]);
    expect(unlistedNames('Prepared PPAP (Production Part Approval Process) documents', cv)).toEqual([]);
    expect(unlistedNames('Prepared Production Part Approval Process (SPC) documents', cv)).not.toEqual([]);
  });
  it('is empty for plain text', () => {
    expect(unlistedNames('Seasoned HR professional with a focus on retail teams', { experience: [] })).toEqual(['HR']);
  });
});
