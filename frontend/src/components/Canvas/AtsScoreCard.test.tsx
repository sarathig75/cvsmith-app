import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AtsScoreCard } from './AtsScoreCard';
import { apiError, mockHttp } from '../../test/mockHttp';

const score = (n: number, text = '') => ({
  score: n,
  checks: [],
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
});
