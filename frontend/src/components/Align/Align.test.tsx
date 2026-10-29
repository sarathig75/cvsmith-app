import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AlignResultPage } from './AlignResultPage';
import { AlignStartPage } from './AlignStartPage';
import { ProtectedRoute } from '../Common/ProtectedRoute';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';
import type { Handler } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';
import type { Alignment, AtsScore } from '../../types';

const score = (n: number): AtsScore => ({
  score: n,
  framework: 'ats-framework-v1',
  first_fix: null,
  checks: [{ id: 'B1', label: 'Must-have skills', passed: false, points: 7, max: 14, fix: 'Add them.' }],
});

const gap = (skill: string, status: 'covered' | 'missing', by_headline = false) => ({
  skill,
  importance: 'core' as const,
  status,
  by_headline,
});

const run: Alignment = {
  id: 'run1',
  created_at: '2026-10-29T10:00:00Z',
  requirements: {
    job_title: 'HR Business Partner',
    core_skills: ['A', 'B'],
    secondary_skills: ['C'],
    years_required: 6,
    needs_management: true,
    sector: 'Human resources',
  },
  positioning: { current: 'Human Resources Director', proposed: 'People leader for scaling retail operations' },
  gaps: [
    gap('Workforce planning', 'missing'),
    gap('HRIS', 'missing'),
    gap('Retail operations', 'missing', true),
    gap('Talent acquisition', 'covered'),
    gap('Employee relations', 'covered'),
    gap('Stakeholder management', 'covered'),
  ],
  consider: ['A short course in workforce analytics.'],
  score: score(71),
};

const quota = { plan: 'pro', limit: 50, used: 1, remaining: 49, resets_at: '' };

function setup(handler: Handler, path = '/align/run1') {
  useAuthStore.getState().setAuth('t', sampleUser);
  const calls = mockHttp((req) => {
    if (req.url === '/api/suggestions/quota') return { status: 200, data: quota };
    return handler(req);
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
          <Route path="/align" element={<AlignStartPage />} />
          <Route path="/align/:id" element={<AlignResultPage />} />
          <Route path="/canvas" element={<h1>Canvas page</h1>} />
          <Route path="/pricing" element={<h1>Pricing page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}

/** The preview answer follows what was ticked: 71 base, +3 for the headline, +4 per skill. */
const resultHandler: Handler = (req) => {
  if (req.url === '/api/alignment/run1') return { status: 200, data: run };
  if (req.url === '/api/alignment/run1/preview') {
    const sel = req.data as { use_headline: boolean; skills: string[] };
    return { status: 200, data: score(71 + (sel.use_headline ? 3 : 0) + 4 * sel.skills.length) };
  }
  return { status: 404, data: {} };
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

describe('Align to job tab', () => {
  it('shows the tab only while on an Align to job screen', async () => {
    setup(resultHandler, '/dashboard');
    expect(screen.queryByRole('link', { name: 'Align to job' })).not.toBeInTheDocument();
  });

  it('shows the tab, as the current page, on the start screen and the result', async () => {
    setup(resultHandler, '/align');
    const tab = screen.getByRole('link', { name: 'Align to job' });
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
});

describe('Align to job: start', () => {
  it('sends the pasted job spec and opens the result', async () => {
    const calls = setup(
      (req) => (req.method === 'post' && req.url === '/api/alignment' ? { status: 201, data: run } : resultHandler(req)),
      '/align',
    );
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Align CV to this job' });
    expect(button).toBeDisabled(); // nothing pasted yet
    await user.type(screen.getByLabelText('Job description'), 'HR Business Partner for retail');
    await user.click(button);
    expect(await screen.findByRole('heading', { name: /Align to a job: HR Business Partner/ })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'post' && c.url === '/api/alignment')?.data).toEqual({
      job_spec: 'HR Business Partner for retail',
    });
  });

  it('explains how the base CV and the job version differ, and the quota', async () => {
    setup(resultHandler, '/align');
    expect(screen.getByText(/your permanent baseline/)).toBeInTheDocument();
    expect(await screen.findByText(/49 of 50 left this month/)).toBeInTheDocument();
  });

  it('offers Pro to a Free user', async () => {
    setup((req) => (req.url === '/api/alignment' ? apiError(402, 'PRO_REQUIRED', 'Align to a job is part of Pro.') : resultHandler(req)), '/align');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Job description'), 'A job');
    await user.click(screen.getByRole('button', { name: 'Align CV to this job' }));
    expect(await screen.findByText('Align to a job is part of Pro.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Pro plans' })).toBeInTheDocument();
  });

  it('shows the server message when it fails, and keeps the pasted text', async () => {
    setup(
      (req) => (req.url === '/api/alignment' ? apiError(503, 'ALIGNMENT_FAILED', "We couldn't align your CV to this job right now.") : resultHandler(req)),
      '/align',
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Job description'), 'A job');
    await user.click(screen.getByRole('button', { name: 'Align CV to this job' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't align your CV");
    expect(screen.getByLabelText('Job description')).toHaveValue('A job');
  });
});

describe('Align to job: result', () => {
  it('shows what was read, the score before and after, positioning, gaps and ideas', async () => {
    setup(resultHandler);
    expect(await screen.findByText(/2 must-have skills, 1 other skill, 6\+ years, management needed, sector Human resources/)).toBeInTheDocument();
    expect(screen.getByTestId('score-now')).toHaveTextContent('71');
    await vi.waitFor(() => expect(screen.getByTestId('score-after')).toHaveTextContent('74')); // headline ticked by default
    expect(screen.getByText('Human Resources Director')).toBeInTheDocument();
    expect(screen.getByText('People leader for scaling retail operations')).toBeInTheDocument();
    expect(screen.getByText('A short course in workforce analytics.')).toBeInTheDocument();
    expect(screen.getAllByText('Missing')).toHaveLength(2); // Retail operations is covered by the headline
  });

  it('keeps the "after" score live as items are ticked, and Addressed holds what was ticked', async () => {
    const calls = setup(resultHandler);
    const user = userEvent.setup();
    await vi.waitFor(() => expect(screen.getByTestId('score-after')).toHaveTextContent('74'));
    await user.click(screen.getByRole('checkbox', { name: 'I have Workforce planning: add to my skills' }));
    await vi.waitFor(() => expect(screen.getByTestId('score-after')).toHaveTextContent('78'));
    const addressed = screen.getByRole('list', { name: 'Addressed' });
    expect(within(addressed).getByText(/Workforce planning: you ticked it/)).toBeInTheDocument();
    expect(screen.getByText('Addressed (2)')).toBeInTheDocument(); // the ticked skill and the headline's "Retail operations"
    expect((calls.filter((c) => c.url.endsWith('/preview')).at(-1)?.data as { skills: string[] }).skills).toEqual(['Workforce planning']);
    // untick the headline: the headline's item goes back to Missing, the score drops
    await user.click(screen.getByRole('checkbox', { name: /People leader for scaling retail operations/ }));
    await vi.waitFor(() => expect(screen.getByTestId('score-after')).toHaveTextContent('75'));
    expect(screen.getByRole('checkbox', { name: 'I have Retail operations: add to my skills' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo Workforce planning' }));
    await vi.waitFor(() => expect(screen.getByTestId('score-after')).toHaveTextContent('71'));
  });

  it('collapses long lists after two rows with "Show N more"', async () => {
    setup(resultHandler);
    const user = userEvent.setup();
    const covered = await screen.findByRole('list', { name: 'Covered' });
    expect(within(covered).getAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Show 1 more ›' }));
    expect(within(screen.getByRole('list', { name: 'Covered' })).getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(within(screen.getByRole('list', { name: 'Covered' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('dismisses a gap, says "Nothing missing" when all are resolved, and can bring dismissed ones back', async () => {
    setup(resultHandler);
    const user = userEvent.setup();
    await screen.findByText('Workforce planning');
    await user.click(screen.getByRole('button', { name: 'Dismiss Workforce planning' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss HRIS' }));
    expect(screen.getByText('Nothing missing.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show 2 dismissed' }));
    expect(screen.getByText('Workforce planning')).toBeInTheDocument();
    expect(screen.queryByText('Nothing missing.')).not.toBeInTheDocument();
  });

  it('updates the base CV with what was ticked, then opens the Canvas', async () => {
    const calls = setup((req) => (req.url === '/api/alignment/run1/apply' ? { status: 200, data: {} } : resultHandler(req)));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: 'I have HRIS: add to my skills' }));
    expect(screen.getByRole('heading', { name: 'What do you want to do with the 2 changes you ticked?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update my CV' }));
    expect(await screen.findByRole('heading', { name: 'Canvas page' })).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/apply'))?.data).toEqual({ use_headline: true, skills: ['HRIS'] });
  });

  it('cannot update the base CV when nothing is ticked, but can still download', async () => {
    setup(resultHandler);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: /People leader for scaling retail operations/ }));
    expect(screen.getByRole('button', { name: 'Update my CV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download PDF for this job' })).toBeEnabled();
  });

  it('downloads a PDF for this job and leaves the page as it is', async () => {
    const calls = setup((req) =>
      req.url === '/api/alignment/run1/download' ? { status: 200, data: new Blob(['%PDF']) } : resultHandler(req),
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Download PDF for this job' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your saved CV is unchanged.');
    expect(calls.find((c) => c.url.endsWith('/download'))?.data).toEqual({ use_headline: true, skills: [] });
    expect(screen.getByRole('heading', { name: /Align to a job: HR Business Partner/ })).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/apply'))).toBe(false); // the base CV is not touched
  });

  it('has no JSON export for a job version', async () => {
    setup(resultHandler);
    await screen.findByRole('button', { name: 'Download PDF for this job' });
    expect(screen.queryByRole('button', { name: /JSON/ })).not.toBeInTheDocument();
  });

  it('says so when no headline could be proposed', async () => {
    setup((req) => (req.url === '/api/alignment/run1' ? { status: 200, data: { ...run, positioning: null } } : resultHandler(req)));
    expect(await screen.findByText(/couldn't propose a headline that stays true to your CV/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /People leader/ })).not.toBeInTheDocument();
  });

  it('shows the three-line explanation and the quota used', async () => {
    setup(resultHandler);
    expect(await screen.findByText(/update your base CV only when you want the changes everywhere/)).toBeInTheDocument();
    expect(await screen.findByText(/This used 1 suggestion \(49 of 50 left this month\)/)).toBeInTheDocument();
  });

  it('shows the error when the alignment cannot be loaded', async () => {
    setup(() => apiError(404, 'NOT_FOUND', 'Alignment not found.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alignment not found.');
  });
});
