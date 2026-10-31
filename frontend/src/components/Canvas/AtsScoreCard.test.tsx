import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AtsScoreCard } from './AtsScoreCard';
import { apiError, mockHttp } from '../../test/mockHttp';

const score = (n: number, text = '') => ({
  score: n,
  checks: [
    { id: 'A3', label: 'Contact details complete', passed: false, points: 7, max: 11, fix: 'Add your phone.' },
    { id: 'A2', label: 'Standard section headings', passed: true, points: 14, max: 14, fix: null },
  ],
  framework: 'ats-framework-v1',
  first_fix: text ? { check_id: 'A6', text, points: 6 } : null,
});

describe('ATS score card on the Canvas', () => {
  it('shows before and after for an uploaded CV, and the first fix', async () => {
    mockHttp(() => ({ status: 200, data: { before: score(61), after: score(78, 'Start more bullets with an action verb.') } }));
    render(<AtsScoreCard ready />);
    expect(await screen.findByTestId('ats-before')).toHaveTextContent('61');
    expect(screen.getByTestId('ats-after')).toHaveTextContent('78');
    expect(screen.getByText(/First fix: Start more bullets with an action verb\. \(\+6\)/)).toBeInTheDocument();
  });

  it('shows only the current score when there was no upload', async () => {
    mockHttp(() => ({ status: 200, data: { before: null, after: score(70) } }));
    render(<AtsScoreCard ready />);
    expect(await screen.findByTestId('ats-after')).toHaveTextContent('70');
    expect(screen.queryByTestId('ats-before')).not.toBeInTheDocument();
  });

  it('asks nothing before the CV is ready', () => {
    const calls = mockHttp(() => ({ status: 200, data: { before: null, after: null } }));
    const { container } = render(<AtsScoreCard ready={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(calls).toHaveLength(0);
  });

  it('saves pending edits before scoring again', async () => {
    const calls = mockHttp(() => ({ status: 200, data: { before: null, after: score(70) } }));
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

  it('does not call the score a guarantee', async () => {
    mockHttp(() => ({ status: 200, data: { before: null, after: score(70) } }));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    expect(screen.getByText(/our own checklist, not a promise/)).toBeInTheDocument();
  });

  it('lists every check with its points and what to fix', async () => {
    mockHttp(() => ({ status: 200, data: { before: null, after: score(70) } }));
    render(<AtsScoreCard ready />);
    await screen.findByTestId('ats-after');
    expect(screen.queryByRole('list', { name: 'ATS checks' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'See the checks ›' }));
    const list = screen.getByRole('list', { name: 'ATS checks' });
    expect(within(list).getByLabelText('7 of 11 points')).toBeInTheDocument();
    expect(within(list).getByText('Contact details complete')).toBeInTheDocument();
    expect(within(list).getByText('Add your phone.')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).queryAllByText('Add your phone.')).toHaveLength(1); // a passed check shows no fix
  });

  it('works the score out again after the canvas has been saved', async () => {
    let n = 0;
    const calls = mockHttp(() => ({ status: 200, data: { before: null, after: score(70 + 8 * n++) } }));
    const { rerender } = render(<AtsScoreCard ready savedCount={0} />);
    await screen.findByTestId('ats-after');
    expect(screen.getByTestId('ats-after')).toHaveTextContent('70');
    rerender(<AtsScoreCard ready savedCount={1} />);
    await vi.waitFor(() => expect(screen.getByTestId('ats-after')).toHaveTextContent('78'), { timeout: 4000 });
    expect(calls).toHaveLength(2);
  });

  it('does not ask again when nothing was saved', async () => {
    const calls = mockHttp(() => ({ status: 200, data: { before: null, after: score(70) } }));
    render(<AtsScoreCard ready savedCount={0} />);
    await screen.findByTestId('ats-after');
    await new Promise((r) => setTimeout(r, 1800));
    expect(calls).toHaveLength(1);
  });
});
