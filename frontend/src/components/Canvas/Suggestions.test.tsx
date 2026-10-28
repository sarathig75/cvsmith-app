import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { AUTOSAVE_DELAY_MS } from './useAutosave';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';
import type { Handler } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { emptyDraft } from '../../types/cvDraft';
import type { CV, Quota, Suggestion } from '../../types';

const JOB = 'Did sales things for many clients';
const BETTER = '• Grew sales across 40 client accounts';
const content = {
  ...emptyDraft('a@b.co'),
  summary: 'Old summary',
  experience: [{ id: 'e1', title: 'Sales Lead', company: 'Acme', start: '', end: '', description: JOB }],
  projects: [{ id: 'p1', name: 'Launch', url: '', start: '', end: '', description: '' }],
};
const cv: CV = {
  id: 'cv1', title: 'My CV', privacy: 'public', parsing_status: 'not_uploaded', parsing_error: null,
  parsing_parts: { basics: 'complete', experience: 'complete', extras: 'complete' }, json_resume: {},
  content, applied_parts: [], content_updated_at: null, created_at: '2026-01-01T00:00:00Z',
};
const quota = (remaining: number): Quota => ({ plan: 'free', limit: 1, used: 1 - remaining, remaining, resets_at: '2026-11-01T00:00:00Z' });
const suggestion = (over: Partial<Suggestion> = {}): Suggestion => ({
  id: 's1', field: 'experience', entry_id: 'e1', original: JOB, suggested: BETTER, changed: true,
  status: 'pending', created_at: '2026-10-14T00:00:00Z', ...over,
});

function setup(onPost: Handler, left = 1) {
  let remaining = left;
  const calls = mockHttp((req) => {
    if (req.url === '/api/suggestions/quota') return { status: 200, data: quota(remaining) };
    if (req.method === 'post' && req.url === '/api/suggestions') {
      const reply = onPost(req);
      if (reply.status === 201 && (reply.data as Suggestion).changed) remaining = 0;
      return reply;
    }
    if (req.method === 'patch' && req.url.startsWith('/api/suggestions/')) return { status: 200, data: suggestion() };
    return { status: 200, data: cv };
  });
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CanvasPage />} />
        <Route path="/pricing" element={<h1>Pricing page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}

const experienceBox = () => screen.getAllByRole('textbox', { name: 'Description' })[0];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useAuthStore.setState({ user: sampleUser, token: 't' } as never);
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('💡 field suggestions', () => {
  it('shows the quota and disables Improve on an empty field', async () => {
    setup(() => ({ status: 201, data: suggestion() }));
    expect(await screen.findByText(/1 free suggestion left this month/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Improve Professional Summary' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Improve Experience 1 Description' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Improve Project 1 Description' })).toBeDisabled();
  });

  it('sends the field with its context, and Use suggestion replaces the text and auto-saves it as an edit', async () => {
    const calls = setup(() => ({ status: 201, data: suggestion() }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Experience 1 Description' }));

    const dialog = await screen.findByRole('dialog', { name: 'Improve: Work Experience description' });
    expect(within(dialog).getByRole('region', { name: 'Current' })).toHaveTextContent(JOB);
    expect(within(dialog).getByRole('region', { name: 'Suggested' })).toHaveTextContent(BETTER);
    expect(calls.find((c) => c.method === 'post')?.data).toEqual({
      field: 'experience', entry_id: 'e1', text: JOB, context: { title: 'Sales Lead', company: 'Acme' },
    });

    await user.click(within(dialog).getByRole('button', { name: 'Use suggestion' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(experienceBox()).toHaveValue(BETTER);
    expect(calls.find((c) => c.method === 'patch' && c.url === '/api/suggestions/s1')?.data).toEqual({ status: 'accepted' });
    expect(await screen.findByText(/0 free suggestions left this month/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    const save = calls.filter((c) => c.method === 'patch' && c.url === '/api/cv').pop()?.data as {
      content: typeof content; edited: boolean;
    };
    expect(save.edited).toBe(true);
    expect(save.content.experience[0].description).toBe(BETTER);
  });

  it('Keep mine leaves the text as it was and records the decline', async () => {
    const calls = setup(() => ({ status: 201, data: suggestion({ field: 'summary', entry_id: null, original: 'Old summary' }) }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Professional Summary' }));
    await user.click(await screen.findByRole('button', { name: 'Keep mine' }));
    expect(screen.getByLabelText('Professional Summary')).toHaveValue('Old summary');
    expect(calls.find((c) => c.url === '/api/suggestions/s1')?.data).toEqual({ status: 'declined' });
  });

  it('says so when nothing needs to change', async () => {
    setup(() => ({ status: 201, data: suggestion({ changed: false, suggested: JOB, status: 'unchanged' }) }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Experience 1 Description' }));
    expect(await screen.findByText(/Already in good shape/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).not.toBeInTheDocument();
  });

  it('shows the error and can try again', async () => {
    let fail = true;
    setup(() => (fail ? apiError(503, 'SUGGESTION_FAILED', "We couldn't write a suggestion right now.") : { status: 201, data: suggestion() }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Experience 1 Description' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't write a suggestion right now.");
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Use suggestion' })).toBeInTheDocument();
  });

  it('offers Pro when the free suggestion is used, with a link to the plans', async () => {
    const message =
      "You've used your free suggestion for this month. Upgrade to Pro for 50 suggestions a month ($9.99/month).";
    setup(() => apiError(402, 'QUOTA_EXCEEDED', message), 0);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Professional Summary' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upgrade to Pro' });
    expect(dialog).toHaveTextContent(message);
    await user.click(within(dialog).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Improve Professional Summary' }));
    await user.click(await screen.findByRole('link', { name: 'See Pro plans' }));
    expect(await screen.findByRole('heading', { name: 'Pricing page' })).toBeInTheDocument();
  });
});

describe('💡 field suggestions in StrictMode', () => {
  it('sends one request per click', async () => {
    const { StrictMode } = await import('react');
    const calls = mockHttp((req) =>
      req.url === '/api/suggestions/quota'
        ? { status: 200, data: quota(1) }
        : req.method === 'post' && req.url === '/api/suggestions'
          ? { status: 201, data: suggestion() }
          : { status: 200, data: cv },
    );
    render(
      <StrictMode>
        <MemoryRouter>
          <CanvasPage />
        </MemoryRouter>
      </StrictMode>,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Experience 1 Description' }));
    await screen.findByRole('button', { name: 'Use suggestion' });
    expect(calls.filter((c) => c.method === 'post' && c.url === '/api/suggestions')).toHaveLength(1);
  });
});

describe('💡 headline', () => {
  it('suggests a headline for an empty field, after saving pending edits, and fills it in', async () => {
    const calls = setup(() => ({
      status: 201,
      data: suggestion({ field: 'headline', entry_id: null, original: '', suggested: 'Sales Lead · Enterprise Accounts' }),
    }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const button = await screen.findByRole('button', { name: 'Suggest Headline' }); // empty headline: "Suggest", not disabled
    await user.type(screen.getByLabelText('Professional Summary'), ' More.');
    await user.click(button);
    expect(await screen.findByRole('region', { name: 'Current' })).toHaveTextContent('(empty)');
    const order = calls.filter((c) => c.method !== 'get').map((c) => `${c.method} ${c.url}`);
    expect(order.slice(0, 2)).toEqual(['patch /api/cv', 'post /api/suggestions']); // saved first, so the AI sees the latest summary
    expect(calls.find((c) => c.method === 'post')?.data).toEqual({ field: 'headline', text: '' });
    await user.click(screen.getByRole('button', { name: 'Use suggestion' }));
    expect(screen.getByLabelText('Headline')).toHaveValue('Sales Lead · Enterprise Accounts');
    expect(screen.getByRole('button', { name: 'Improve Headline' })).toBeEnabled();
  });
});

describe('💡 summary', () => {
  it('suggests a new summary when the field is empty, after saving pending edits', async () => {
    const calls = setup(() => ({
      status: 201,
      data: suggestion({ field: 'summary', entry_id: null, original: '', suggested: 'Sales lead with 8 years in enterprise accounts.' }),
    }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.clear(await screen.findByLabelText('Professional Summary'));
    await user.click(screen.getByRole('button', { name: 'Suggest Professional Summary' })); // empty: "Suggest", not disabled
    expect(await screen.findByRole('region', { name: 'Current' })).toHaveTextContent('(empty)');
    const order = calls.filter((c) => c.method !== 'get').map((c) => `${c.method} ${c.url}`);
    expect(order.slice(0, 2)).toEqual(['patch /api/cv', 'post /api/suggestions']);
    expect(calls.find((c) => c.method === 'post')?.data).toEqual({ field: 'summary', text: '' });
    await user.click(screen.getByRole('button', { name: 'Use suggestion' }));
    expect(screen.getByLabelText('Professional Summary')).toHaveValue('Sales lead with 8 years in enterprise accounts.');
  });
});

describe('💡 edit after accept', () => {
  it('counts the first edit of an accepted suggestion, and sends no text', async () => {
    const calls = setup(() => ({
      status: 201,
      data: suggestion({ field: 'summary', entry_id: null, original: 'Old summary', suggested: 'New summary' }),
    }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Improve Professional Summary' }));
    await user.click(await screen.findByRole('button', { name: 'Use suggestion' }));
    const edited = () => calls.filter((c) => c.method === 'post' && c.url === '/api/suggestions/s1/edited');
    expect(edited()).toHaveLength(0); // accepting is not an edit
    await user.type(screen.getByLabelText('Professional Summary'), '!');
    expect(edited()).toHaveLength(1);
    expect(edited()[0].data).toBeUndefined();
    await user.type(screen.getByLabelText('Professional Summary'), '?');
    expect(edited()).toHaveLength(1); // only the first edit is counted
  });
});
