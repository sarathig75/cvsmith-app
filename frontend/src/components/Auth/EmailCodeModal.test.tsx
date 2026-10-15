import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EmailCodeModal, RESEND_SECONDS } from './EmailCodeModal';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';
import type { Handler } from '../../test/mockHttp';

const token = { access_token: 'tok', token_type: 'bearer', user: sampleUser };
const sent = { status: 200, data: { message: "We've sent a 6-digit code to a@b.co. It expires in 10 minutes." } };

function setup(handler: Handler, mode: 'start' | 'login' = 'start') {
  const calls = mockHttp(handler);
  render(
    <MemoryRouter>
      <EmailCodeModal mode={mode} onClose={vi.fn()} />
    </MemoryRouter>,
  );
  return calls;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useAuthStore.getState().clearAuth();
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('EmailCodeModal', () => {
  it('validates the email before asking for a code', async () => {
    const calls = setup(() => sent);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('emails a code, logs in with it, and uploads a CV chosen before', async () => {
    const calls = setup(({ url }) =>
      url === '/api/auth/code' ? sent : url === '/api/auth/code/verify' ? { status: 201, data: token } : url === '/api/cv' ? apiError(404, 'NOT_FOUND') : { status: 201, data: {} },
    );
    useUploadStore.getState().setPendingFile(new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText(/email address/i), ' a@b.co ');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByText(/sent a 6-digit code to a@b.co/)).toBeInTheDocument();
    const codeBox = screen.getByLabelText(/6-digit code/i);
    expect(codeBox).toHaveFocus();
    await user.type(codeBox, '12a34 56');
    expect(codeBox).toHaveValue('123456'); // digits only
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(useUploadStore.getState().status).toBe('done'));
    expect(useAuthStore.getState().token).toBe('tok');
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/code', '/api/auth/code/verify', '/api/cv', '/api/cv/upload']);
    expect(calls[1].data).toEqual({ email: 'a@b.co', code: '123456' });
  });

  it('shows a wrong code inline and keeps the user logged out', async () => {
    setup(({ url }) => (url === '/api/auth/code' ? sent : apiError(400, 'INVALID_CODE', 'That code is not right. 4 tries left.')), 'login');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    expect(screen.getByRole('dialog', { name: 'Log in' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    await user.type(await screen.findByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('That code is not right. 4 tries left.')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('lets the user ask for a new code after the wait', async () => {
    const calls = setup(() => sent);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    const resend = await screen.findByRole('button', { name: /Send a new code in \d+s/ });
    expect(resend).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync((RESEND_SECONDS + 1) * 1000));
    await user.click(screen.getByRole('button', { name: 'Send a new code' }));
    expect(calls.filter((c) => c.url === '/api/auth/code')).toHaveLength(2);
  });

  it('shows email and wait errors from the server', async () => {
    setup(() => apiError(503, 'EMAIL_FAILED', "We couldn't send the email right now."));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send the email right now.");
  });

  it('explains the private beta to an address that is not invited', async () => {
    setup(() => apiError(403, 'NOT_INVITED', 'CVSmith is in private beta. Please ask us for an invite to join.'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText(/email address/i), 'stranger@b.co');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('private beta');
    expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
  });
});
