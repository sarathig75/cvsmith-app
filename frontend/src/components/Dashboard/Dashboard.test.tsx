import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { NextPage } from './NextPage';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';
import type { Handler } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';
import type { Dashboard } from '../../types';

const ready: Dashboard = {
  state: 'ready',
  plan: 'free',
  cv_strength: {
    percent: 64,
    sections: [{ key: 'experience', label: 'Work experience', points: 10, max: 30, complete: false }],
    next_step: { section: 'experience', points: 20, text: 'Add a role with its title, employer and dates to reach 84%.' },
  },
  ats: {
    score: 78,
    framework: 'ats-framework-v2',
    checks: [{ id: 'A3', label: 'Contact details complete', passed: false, points: 7, max: 11, fix: 'Add your phone.' }],
    first_fix: { check_id: 'A3', text: 'Add your phone.', points: 4 },
  },
};

function setup(handler: Handler, path = '/dashboard') {
  const calls = mockHttp(handler);
  useAuthStore.getState().setAuth('t', sampleUser);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/next" element={<NextPage />} />
        <Route path="/canvas" element={<h1>Canvas page</h1>} />
        <Route path="/pricing" element={<h1>Pricing page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

describe('dashboard', () => {
  it('shows CV strength with its next step and the ATS score with its first fix', async () => {
    setup(() => ({ status: 200, data: ready }));
    expect(await screen.findByText('64%')).toBeInTheDocument();
    expect(screen.getByText(/Add a role with its title, employer and dates to reach 84%\./)).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText(/First fix: Add your phone\. \(\+4\)/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'CV strength' })).toHaveAttribute('aria-valuenow', '64');
    expect(screen.queryByText(/compliant|compliance/i)).not.toBeInTheDocument();
  });

  it('offers Align to a job as a small card that opens its own screen', async () => {
    setup(() => ({ status: 200, data: ready }));
    const card = await screen.findByRole('link', { name: /Align to a job.*Pro/s });
    expect(card).toHaveAttribute('href', '/align');
    expect(screen.queryByPlaceholderText(/Paste the job description/)).not.toBeInTheDocument(); // the paste box is on its own screen
  });

  it('lets the user upload a new CV from the dashboard, after the replace warning, then opens the Canvas', async () => {
    const calls = setup((req) =>
      req.method === 'post' && req.url === '/api/cv/upload' ? { status: 201, data: {} } : { status: 200, data: ready },
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Upload a new CV' }));
    expect(screen.getByText('What should happen to your current CV?')).toBeInTheDocument();
    await user.upload(
      screen.getByTestId('replace-cv-input'),
      new File(['%PDF-1.4'], 'new.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload and replace' }));
    expect(await screen.findByRole('heading', { name: 'Canvas page' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'post' && c.url === '/api/cv/upload')).toBe(true);
  });

  it('shows the error and stays on the dashboard when the new CV cannot be uploaded', async () => {
    setup((req) =>
      req.method === 'post' && req.url === '/api/cv/upload'
        ? apiError(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and DOCX files are supported.')
        : { status: 200, data: ready },
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Upload a new CV' }));
    await user.upload(
      screen.getByTestId('replace-cv-input'),
      new File(['%PDF-1.4'], 'new.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload and replace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PDF and DOCX files are supported.');
    expect(screen.getByText('64%')).toBeInTheDocument();
  });

  it('shows the upload prompt, not a 0% score, when there is no CV', async () => {
    setup(() => ({ status: 200, data: { state: 'no_cv', plan: 'free', cv_strength: null, ats: null } }));
    expect(await screen.findByRole('heading', { name: 'Start with your CV' })).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('ATS format score')).not.toBeInTheDocument();
  });

  it('says so while the CV is being read and when it could not be read', async () => {
    setup(() => ({ status: 200, data: { state: 'parsing', plan: 'free', cv_strength: null, ats: null } }));
    expect(await screen.findByText(/We are reading your CV/)).toBeInTheDocument();
  });

  it('offers manual entry when the CV could not be read', async () => {
    setup(() => ({ status: 200, data: { state: 'needs_details', plan: 'free', cv_strength: null, ats: null } }));
    expect(await screen.findByText(/couldn't read your CV automatically/)).toBeInTheDocument();
  });

  it('does not invent a score when the server could not work one out', async () => {
    setup(() => ({ status: 200, data: { ...ready, ats: null } }));
    expect(await screen.findByText(/couldn't work out your score/)).toBeInTheDocument();
  });

  it('downloads the PDF and then lands on "what next"', async () => {
    const calls = setup((req) =>
      req.url === '/api/cv/download' ? { status: 200, data: new Blob(['%PDF']) } : { status: req.url === '/api/next/viewed' ? 204 : 200, data: ready },
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByRole('heading', { name: /Your CV is downloaded/ })).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/cv/download')).toBe(true);
    expect(calls.some((c) => c.method === 'post' && c.url === '/api/next/viewed')).toBe(true);
  });

  it('offers Pro when a free user exports JSON', async () => {
    setup((req) => (req.url === '/api/cv/export' ? apiError(402, 'PRO_REQUIRED', 'JSON export is part of Pro.') : { status: 200, data: ready }));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Export JSON/ }));
    expect(await screen.findByText('JSON export is part of Pro.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Pro plans' })).toBeInTheDocument();
  });
});

describe('what next', () => {
  it('names the real section and check that are not complete, and every card opens a page', async () => {
    setup(() => ({ status: 200, data: ready }), '/next');
    expect(await screen.findByText('2 · CV strength: 64%')).toBeInTheDocument();
    expect(screen.getByText(/Work experience adds 20 points\./)).toBeInTheDocument();
    expect(screen.getByText('3 · ATS format score: 78')).toBeInTheDocument();
    expect(screen.getByText(/The check "Contact details complete" is not passed yet \(\+4\)\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to your dashboard/ })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Align your CV to a job spec/ })).toHaveAttribute('href', '/align');
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); // cards are the action; no buttons
  });

  it('still works, without numbers, if the dashboard cannot be loaded', async () => {
    setup((req) => (req.url === '/api/dashboard' ? apiError(500, 'SERVER_ERROR') : { status: 204 }), '/next');
    expect(await screen.findByRole('link', { name: /Go to your dashboard/ })).toBeInTheDocument();
    expect(screen.queryByText(/CV strength:/)).not.toBeInTheDocument();
  });
});
