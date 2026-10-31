import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AtsScoreCard } from './AtsScoreCard';
import { apiError, mockHttp } from '../../test/mockHttp';
import type { AtsCheck, AtsScore } from '../../types';

const check = (over: Partial<AtsCheck>): AtsCheck => ({
  id: 'A3',
  label: 'Contact details complete',
  passed: false,
  points: 7,
  max: 11,
  fix: 'Add your phone.',
  group: 'searchability',
  fix_kind: 'go_contact',
  ...over,
});

const score = (n: number, text = ''): AtsScore => ({
  score: n,
  framework: 'ats-framework-v2',
  first_fix: text ? { check_id: 'A6', text, points: 6 } : null,
  checks: [
    check({}),
    check({ id: 'A5', label: 'Consistent dates', points: 4, max: 9, fix: 'Use one date format throughout.', fix_kind: 'dates_format' }),
    check({ id: 'A2', label: 'Standard section headings', passed: true, points: 12, max: 12, fix: null, fix_kind: null }),
    check({ id: 'A6', label: 'Bullets start with a strong verb', points: 5, max: 10, fix: 'Start more bullets with an action verb.', group: 'writing', fix_kind: 'improve_wording' }),
  ],
  groups: [
    { key: 'searchability', label: 'Searchability', points: 23, max: 32, percent: 72, issues: 2 },
    { key: 'writing', label: 'Writing', points: 5, max: 10, percent: 50, issues: 1 },
  ],
});

const pair = (after: AtsScore, before: AtsScore | null = null) => ({ status: 200, data: { before, after } });

describe('ATS score panel on the Canvas', () => {
  it('shows the score in a ring, with the score before the edits', async () => {
    mockHttp(() => pair(score(78), score(61)));
    render(<AtsScoreCard ready />);
    expect(await screen.findByRole('img', { name: 'ATS score 78 out of 100' })).toBeInTheDocument();
    expect(screen.getByTestId('ats-after')).toHaveTextContent('78');
    expect(screen.getByTestId('ats-before')).toHaveTextContent('61');
  });

  it('shows no "before" when there was no upload', async () => {
    mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    expect(screen.queryByTestId('ats-before')).not.toBeInTheDocument();
  });

  it('asks nothing before the CV is ready', () => {
    const calls = mockHttp(() => pair(score(70)));
    const { container } = render(<AtsScoreCard ready={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(calls).toHaveLength(0);
  });

  it('shows one bar per group with its issue count, and the details stay collapsed', async () => {
    mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    expect(screen.getByRole('progressbar', { name: 'Searchability' })).toHaveAttribute('aria-valuenow', '72');
    expect(screen.getByRole('progressbar', { name: 'Writing' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('button', { name: '2 issues to fix in Searchability' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '1 issue to fix in Writing' })).toBeInTheDocument();
    expect(screen.queryByText('Add your phone.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Searchability issues' })).not.toBeInTheDocument();
  });

  it('opens only the group that was clicked, with each failing check, its points and what to change', async () => {
    mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    await userEvent.click(screen.getByRole('button', { name: '2 issues to fix in Searchability' }));
    const list = screen.getByRole('list', { name: 'Searchability issues' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2); // passing checks are not listed
    expect(within(list).getByLabelText('7 of 11 points')).toBeInTheDocument();
    expect(within(list).getByText('Add your phone.')).toBeInTheDocument();
    expect(within(list).getByText('Use one date format throughout.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Writing issues' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2 issues to fix in Searchability' }));
    expect(screen.queryByRole('list', { name: 'Searchability issues' })).not.toBeInTheDocument();
  });

  it('says "All good" for a group with no issues', async () => {
    const s = score(90);
    s.groups = s.groups?.map((g) => (g.key === 'writing' ? { ...g, issues: 0, percent: 100 } : g));
    mockHttp(() => pair(s));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('puts the button for a failing check under it, and nothing under a check with no fix_kind', async () => {
    mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready renderFix={(c) => (c.fix_kind ? <button type="button">Fix {c.id}</button> : null)} />);
    await screen.findByTestId('ats-after');
    await userEvent.click(screen.getByRole('button', { name: '2 issues to fix in Searchability' }));
    expect(screen.getByRole('button', { name: 'Fix A3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fix A5' })).toBeInTheDocument();
  });

  it('offers "Fix all" only when there is an automatic fix, and runs it', async () => {
    mockHttp(() => pair(score(70)));
    const onFixAll = vi.fn();
    render(<AtsScoreCard ready onFixAll={onFixAll} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Fix all' }));
    expect(onFixAll).toHaveBeenCalledTimes(1);
  });

  it('has no "Fix all" when nothing can be fixed automatically', async () => {
    const s = score(70);
    s.checks = s.checks.filter((c) => c.fix_kind !== 'dates_format');
    mockHttp(() => pair(s));
    render(<AtsScoreCard ready onFixAll={vi.fn()} />);
    await screen.findByTestId('ats-after');
    expect(screen.queryByRole('button', { name: 'Fix all' })).not.toBeInTheDocument();
  });

  it('shows the Improve all slot and a notice', async () => {
    mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready improveSlot={<button type="button">Improve all</button>} notice={<p>Dates fixed.</p>} />);
    await screen.findByTestId('ats-after');
    expect(screen.getByRole('button', { name: 'Improve all' })).toBeInTheDocument();
    expect(screen.getByText('Dates fixed.')).toBeInTheDocument();
  });

  it('saves pending edits before scoring again', async () => {
    const calls = mockHttp(() => pair(score(70)));
    const order: string[] = [];
    const flush = vi.fn(async () => {
      order.push(`flush after ${calls.length} call(s)`);
    });
    render(<AtsScoreCard ready flush={flush} />);
    await screen.findByTestId('ats-after');
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(order).toEqual(['flush after 1 call(s)']);
  });

  it('says so, and shows no invented number, when scoring fails', async () => {
    mockHttp(() => apiError(500, 'SERVER_ERROR'));
    render(<AtsScoreCard ready />);
    expect(await screen.findByText(/couldn't work out your score/)).toBeInTheDocument();
    expect(screen.getByTestId('ats-after')).toHaveTextContent('–');
  });

  it('works the score out again after the canvas has been saved', async () => {
    let n = 0;
    const calls = mockHttp(() => pair(score(70 + 8 * n++)));
    const { rerender } = render(<AtsScoreCard ready savedCount={0} />);
    await screen.findByTestId('ats-after');
    expect(screen.getByTestId('ats-after')).toHaveTextContent('70');
    rerender(<AtsScoreCard ready savedCount={1} />);
    await vi.waitFor(() => expect(screen.getByTestId('ats-after')).toHaveTextContent('78'), { timeout: 4000 });
    expect(calls).toHaveLength(2);
  });

  it('does not ask again when nothing was saved', async () => {
    const calls = mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready savedCount={0} />);
    await screen.findByTestId('ats-after');
    await new Promise((r) => setTimeout(r, 1800));
    expect(calls).toHaveLength(1);
  });

  it('does not call the score a guarantee', async () => {
    mockHttp(() => pair(score(70)));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    expect(screen.getByText(/our own checklist, not a promise/)).toBeInTheDocument();
  });

  it('copes with a score stored before groups existed (no bars, still the number)', async () => {
    const old = { ...score(70), groups: undefined };
    mockHttp(() => pair(old));
    render(<AtsScoreCard ready />);
    await screen.findByRole('img', { name: 'ATS score 70 out of 100' });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
