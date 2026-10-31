import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { AUTOSAVE_DELAY_MS } from './useAutosave';
import { OnboardingScreen } from '../Auth/OnboardingScreen';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';
import { refreshIfDue, REFRESH_EVERY_MS } from '../../services/session';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { emptyDraft } from '../../types/cvDraft';
import type { CV } from '../../types';

const cv: CV = {
  id: 'cv1', title: 'My CV', privacy: 'public', parsing_status: 'not_uploaded', parsing_error: null,
  parsing_parts: { basics: 'complete', experience: 'complete', extras: 'complete' }, json_resume: {},
  content: { ...emptyDraft('a@b.co'), personal: { ...emptyDraft().personal, name: 'Saved Name' } },
  applied_parts: [], content_updated_at: null, created_at: '2026-01-01T00:00:00Z',
};
const quota = { status: 200, data: { plan: 'free', limit: 1, used: 0, remaining: 1, resets_at: '' } };
/** An unsigned JWT-shaped token with the given issue time (the app only reads "iat"). */
const tokenIssuedAt = (ms: number) => `x.${btoa(JSON.stringify({ iat: Math.floor(ms / 1000) }))}.y`;

const renderCanvas = () =>
  render(
    <MemoryRouter>
      <CanvasPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  useAuthStore.setState({ user: sampleUser, token: 't', sessionExpired: false } as never);
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('session expiry', () => {
  it('keeps unsaved edits when the session ends and offers them back after login', async () => {
    let expired = false;
    mockHttp((req) => {
      if (req.url === '/api/suggestions/quota') return quota;
      if (req.url === '/api/ats') return { status: 200, data: { before: null, after: null } };
      if (expired) return apiError(401, 'UNAUTHORIZED', 'Invalid or expired token.');
      return { status: 200, data: cv };
    });
    const first = renderCanvas();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const name = await screen.findByLabelText('Full Name');
    expired = true;
    await user.clear(name);
    await user.type(name, 'Unsaved Name');
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 100)); // the save gets a 401
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(true);
    first.unmount();

    // The start page explains what happened.
    render(
      <MemoryRouter>
        <OnboardingScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Your session expired/)).toBeInTheDocument();

    // After logging in again, the kept edits are offered back.
    expired = false;
    useAuthStore.getState().setAuth('t2', sampleUser);
    renderCanvas();
    expect(await screen.findByText(/session ended before your last changes were saved/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Full Name').at(-1)).toHaveValue('Saved Name');
    await user.click(screen.getByRole('button', { name: 'Restore my changes' }));
    expect(screen.getAllByLabelText('Full Name').at(-1)).toHaveValue('Unsaved Name');
    expect(localStorage.getItem('cvsmith_unsaved_draft')).toBeNull();
  });

  it("never offers another user's kept edits", async () => {
    localStorage.setItem('cvsmith_unsaved_draft', JSON.stringify({ userId: 'someone-else', draft: emptyDraft(), appliedParts: [], at: '' }));
    mockHttp((req) => (req.url === '/api/suggestions/quota' ? quota : { status: 200, data: cv }));
    renderCanvas();
    expect(await screen.findByLabelText('Full Name')).toHaveValue('Saved Name');
    expect(screen.queryByText(/session ended/)).not.toBeInTheDocument();
  });
});

describe('keep-alive', () => {
  it('refreshes a token older than an hour, and not a newer one', async () => {
    const now = Date.now();
    const calls = mockHttp(() => ({ status: 200, data: { access_token: 'fresh', token_type: 'bearer', user: sampleUser } }));
    useAuthStore.setState({ token: tokenIssuedAt(now - 5 * 60 * 1000) } as never);
    await refreshIfDue(now);
    expect(calls).toHaveLength(0);

    useAuthStore.setState({ token: tokenIssuedAt(now - REFRESH_EVERY_MS - 1000) } as never);
    await refreshIfDue(now);
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/refresh']);
    expect(useAuthStore.getState().token).toBe('fresh');
  });
});
