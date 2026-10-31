import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { FAST_POLL_MS, POLL_GIVE_UP_MS, POLL_INTERVAL_MS } from './CvStatus';
import { AUTOSAVE_DELAY_MS, RETRY_DELAY_MS } from './useAutosave';
import { apiError } from '../../test/mockHttp';
import { emptyDraft } from '../../types/cvDraft';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { mockHttp, sampleUser } from '../../test/mockHttp';
import type { CV } from '../../types';

const baseCv: CV = {
  id: 'cv1',
  title: 'My CV',
  privacy: 'public',
  parsing_status: 'pending',
  parsing_error: null,
  parsing_parts: { basics: 'pending', experience: 'pending', extras: 'pending' },
  json_resume: {},
  content: null,
  applied_parts: [],
  content_updated_at: null,
  created_at: '2026-01-01T00:00:00Z',
};
const allComplete = { basics: 'complete', experience: 'complete', extras: 'complete' } as const;
const parsed = { basics: { name: 'Jane From CV', email: 'jobs@jane.dev', phone: '+44 1234', summary: 'Parsed summary.' } };

function renderCanvas() {
  render(
    <MemoryRouter>
      <CanvasPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useAuthStore.setState({ user: sampleUser, token: 't' } as never);
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CanvasPage with background CV parsing', () => {
  it('lets the user edit while parsing runs, then fills only the empty fields', async () => {
    let cv: CV = baseCv;
    const calls = mockHttp(() => ({ status: 200, data: cv }));
    renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    expect(await screen.findByText(/You can start editing now/)).toBeInTheDocument();
    // The canvas is usable straight away: the user types their own name.
    await user.type(screen.getByLabelText('Full Name'), 'Jane Typed');

    cv = { ...baseCv, parsing_status: 'complete', parsing_parts: allComplete, json_resume: parsed };
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByText(/We filled in details from your CV/)).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Typed'); // user's edit wins
    expect(screen.getByLabelText('Phone')).toHaveValue('+44 1234'); // empty field filled
    expect(screen.getByLabelText('Email')).toHaveValue('jobs@jane.dev'); // CV email replaces the pre-filled account email
    expect(screen.getByPlaceholderText('Brief overview of your experience...')).toHaveValue('Parsed summary.');

    // polling stops once parsing is complete (only the auto-save still talks to the server)
    const gets = () => calls.filter((c) => c.method === 'get' && c.url === '/api/cv').length;
    const count = gets();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(gets()).toBe(count);
  });

  it('fills each group as soon as its part is ready and marks the groups still waiting', async () => {
    let cv: CV = { ...baseCv, parsing_status: 'in_progress' };
    mockHttp(() => ({ status: 200, data: cv }));
    renderCanvas();
    expect(await screen.findAllByText('Filling in from your CV…')).toHaveLength(5);
    expect(screen.getByTestId('part-basics')).toHaveAttribute('data-status', 'pending');

    // contact details arrive first: Personal details fills, the summary (experience part) does not yet
    cv = {
      ...cv,
      parsing_parts: { basics: 'complete', experience: 'pending', extras: 'pending' },
      json_resume: { basics: { name: 'Jane From CV' } },
    };
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(await screen.findByDisplayValue('Jane From CV')).toBeInTheDocument();
    expect(screen.getAllByText('Filling in from your CV…')).toHaveLength(4);
    // the progress line at the top ticks off each part as it arrives
    expect(screen.getByTestId('part-basics')).toHaveAttribute('data-status', 'complete');
    expect(screen.getByTestId('part-experience')).toHaveAttribute('data-status', 'pending');
    expect(screen.getByTestId('part-basics')).toHaveTextContent('Contact details: done');

    // the user clears the parsed name; later parts must not bring it back
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.clear(screen.getByLabelText('Full Name'));

    // experience is done, extras failed: the parse is complete with one failed part
    cv = {
      ...cv,
      parsing_status: 'complete',
      parsing_parts: { basics: 'complete', experience: 'complete', extras: 'failed' },
      json_resume: { basics: { name: 'Jane From CV', summary: 'Parsed summary.' } },
    };
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(await screen.findByDisplayValue('Parsed summary.')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('');
    expect(screen.queryByText('Filling in from your CV…')).not.toBeInTheDocument();
    // Professional details (projects), Skills & Certifications and Others come from the failed part
    expect(screen.getAllByText("We couldn't fill this in from your CV. Please add it yourself.")).toHaveLength(3);
  });

  it('shows email and phone from the instant contact step before the AI parts finish', async () => {
    let cv: CV = { ...baseCv, parsing_status: 'in_progress' };
    mockHttp(() => ({ status: 200, data: cv }));
    renderCanvas();
    await screen.findAllByText('Filling in from your CV…');
    cv = {
      ...cv,
      parsing_parts: { contact: 'complete', basics: 'pending', experience: 'pending', extras: 'pending' },
      json_resume: { basics: { email: 'jobs@jane.dev', phone: '+44 1234' } },
    };
    await act(() => vi.advanceTimersByTimeAsync(FAST_POLL_MS));
    expect(await screen.findByDisplayValue('+44 1234')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('jobs@jane.dev');
    expect(screen.getByLabelText('Full Name')).toHaveValue(''); // the name needs the AI part

    cv = {
      ...cv,
      parsing_parts: { contact: 'complete', basics: 'complete', experience: 'pending', extras: 'pending' },
      json_resume: { basics: { name: 'Jane From CV', email: 'other@jane.dev', phone: '+44 1234' } },
    };
    await act(() => vi.advanceTimersByTimeAsync(FAST_POLL_MS));
    expect(await screen.findByDisplayValue('Jane From CV')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('jobs@jane.dev'); // already filled: kept
  });

  it('does not reset a privacy change while parsing status is being checked', async () => {
    mockHttp(() => ({ status: 200, data: baseCv }));
    renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await screen.findByText(/You can start editing now/);
    await user.click(screen.getByRole('radio', { name: /Private/ }));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2));
    expect(screen.getByRole('radio', { name: /Private/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the parsing error and keeps the canvas editable', async () => {
    mockHttp(() => ({ status: 200, data: { ...baseCv, parsing_status: 'failed', parsing_error: 'This PDF could not be read.' } }));
    renderCanvas();
    expect(await screen.findByText(/couldn't read your CV automatically: This PDF could not be read\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeEnabled();
  });

  it('stops polling and says so if parsing takes too long', async () => {
    const calls = mockHttp(() => ({ status: 200, data: baseCv }));
    renderCanvas();
    await screen.findByText(/You can start editing now/);
    await act(() => vi.advanceTimersByTimeAsync(POLL_GIVE_UP_MS + POLL_INTERVAL_MS));
    expect(await screen.findByText(/taking longer than usual/)).toBeInTheDocument();
    const count = calls.filter((c) => c.method === 'get' && c.url === '/api/cv').length;
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(calls.filter((c) => c.method === 'get' && c.url === '/api/cv').length).toBe(count);
  });
});

describe('CanvasPage saving', () => {
  const saves = (calls: { method: string; data: unknown }[]) =>
    calls.filter((c) => c.method === 'patch').map((c) => c.data as { content: { personal: { name: string } }; applied_parts: string[]; edited: boolean });

  it('restores the saved canvas and does not re-apply parts it already merged', async () => {
    const content = { ...emptyDraft(), personal: { ...emptyDraft().personal, name: 'Saved Name' } };
    const cv: CV = {
      ...baseCv,
      parsing_status: 'complete',
      parsing_parts: allComplete,
      json_resume: { basics: { name: 'Parsed Name', phone: '+44 1' } },
      content,
      applied_parts: ['basics'],
    };
    const calls = mockHttp(() => ({ status: 200, data: cv }));
    renderCanvas();
    expect(await screen.findByDisplayValue('Saved Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toHaveValue(''); // basics was already applied: the user's version stands
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    // the other parts were merged (no data for them here); that is saved, but it is not a user edit
    expect(saves(calls).map((b) => [b.applied_parts, b.edited])).toEqual([[['basics', 'experience', 'extras'], false]]);
  });

  it('saves about two seconds after the user stops typing and says so', async () => {
    const calls = mockHttp(() => ({ status: 200, data: { ...baseCv, parsing_status: 'not_uploaded' } }));
    renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(await screen.findByLabelText('Full Name'), 'Jane');
    expect(saves(calls)).toEqual([]);
    expect(await screen.findByText('Saving…')).toBeInTheDocument(); // shown as soon as there are unsaved changes
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(saves(calls)).toHaveLength(1);
    expect(saves(calls)[0]).toMatchObject({ content: { personal: { name: 'Jane' } }, edited: true });
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    // nothing changed: no further saves
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 3));
    expect(saves(calls)).toHaveLength(1);
  });

  it('retries a failed save and keeps the edit flag', async () => {
    let fail = true;
    const calls = mockHttp((req) =>
      req.method === 'patch' && fail ? apiError(500, 'SERVER_ERROR') : { status: 200, data: null },
    );
    renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(await screen.findByLabelText('Phone'), '1');
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(await screen.findByText(/Couldn't save your latest changes/)).toBeInTheDocument();
    fail = false;
    await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAY_MS));
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    expect(saves(calls).map((b) => b.edited)).toEqual([true, true]);
  });

  it('never saves when the saved CV could not be loaded', async () => {
    const calls = mockHttp(() => apiError(500, 'SERVER_ERROR'));
    renderCanvas();
    expect(await screen.findByText(/changes on this page are not being saved/)).toBeInTheDocument();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText('Full Name'), 'X');
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    expect(saves(calls)).toEqual([]);
  });

  it('asks before a file chosen at login replaces the saved CV', async () => {
    const content = { ...emptyDraft(), personal: { ...emptyDraft().personal, name: 'Saved Name' } };
    const calls = mockHttp((req) =>
      req.url.endsWith('/upload') ? { status: 201, data: baseCv } : { status: 200, data: { ...baseCv, parsing_status: 'complete', parsing_parts: allComplete, content } },
    );
    const file = new File(['%PDF'], 'new-cv.pdf', { type: 'application/pdf' });
    useUploadStore.setState({ pendingFile: file, status: 'confirm', error: null });
    renderCanvas();
    expect(await screen.findByText(/You chose a new CV file \(new-cv.pdf\)/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/upload'))).toBe(false);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'Keep my current CV' }));
    expect(screen.queryByText(/You chose a new CV file/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Saved Name');
    expect(calls.some((c) => c.url.endsWith('/upload'))).toBe(false);
  });

  it('replaces the CV when the user confirms', async () => {
    const content = { ...emptyDraft(), personal: { ...emptyDraft().personal, name: 'Saved Name' } };
    let uploaded = false;
    const calls = mockHttp((req) => {
      if (req.url.endsWith('/upload')) {
        uploaded = true;
        return { status: 201, data: baseCv };
      }
      return { status: 200, data: uploaded ? baseCv : { ...baseCv, parsing_status: 'complete', parsing_parts: allComplete, content } };
    });
    useUploadStore.setState({ pendingFile: new File(['%PDF'], 'new-cv.pdf'), status: 'confirm', error: null });
    renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Replace my CV' }));
    expect(await screen.findByText(/Reading your CV/)).toBeInTheDocument();
    expect(calls.filter((c) => c.url.endsWith('/upload'))).toHaveLength(1);
    expect(screen.getByLabelText('Full Name')).toHaveValue(''); // the old edits are gone
  });
});

describe('CanvasPage preview follows the section being edited', () => {
  it('follows every move to another section, including within one group, but not every field', async () => {
    const content = {
      ...emptyDraft(),
      summary: 'Analyst.',
      experience: [{ id: 'w1', title: 'Analyst', company: 'Acme', start: '', end: '', description: '' }],
      projects: [{ id: 'p1', name: 'Dashboard', url: '', start: '', end: '', description: '' }],
    };
    mockHttp(() => ({ status: 200, data: { ...baseCv, parsing_status: 'not_uploaded', content } }));
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(await screen.findByPlaceholderText('Brief overview of your experience...'));
    expect(scrollTo).toHaveBeenCalledTimes(1); // summary
    await user.click(screen.getByDisplayValue('Acme'));
    expect(scrollTo).toHaveBeenCalledTimes(2); // experience: same group, different section
    await user.click(screen.getByDisplayValue('Analyst'));
    expect(scrollTo).toHaveBeenCalledTimes(2); // another field in the same section: the preview stays where the user put it
    await user.click(screen.getByDisplayValue('Dashboard'));
    expect(scrollTo).toHaveBeenCalledTimes(3); // projects
    await user.click(screen.getByDisplayValue('Acme'));
    expect(scrollTo).toHaveBeenCalledTimes(4); // back to experience, even after scrolling elsewhere
  });
});

