import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { POLL_GIVE_UP_MS, POLL_INTERVAL_MS } from './CvStatus';
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
  json_resume: {},
  created_at: '2026-01-01T00:00:00Z',
};
const parsed = { basics: { name: 'Jane From CV', phone: '+44 1234', summary: 'Parsed summary.' } };

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

    cv = { ...baseCv, parsing_status: 'complete', json_resume: parsed };
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByText(/We filled in details from your CV/)).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Typed'); // user's edit wins
    expect(screen.getByLabelText('Phone')).toHaveValue('+44 1234'); // empty field filled
    expect(screen.getByPlaceholderText('Brief overview of your experience...')).toHaveValue('Parsed summary.');

    // polling stops once parsing is complete
    const count = calls.length;
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(calls.length).toBe(count);
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
    const count = calls.length;
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(calls.length).toBe(count);
  });
});
