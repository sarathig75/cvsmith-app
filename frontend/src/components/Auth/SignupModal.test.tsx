import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignupModal } from './SignupModal';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';

function setup() {
  const onClose = vi.fn();
  const onSwitch = vi.fn();
  render(
    <MemoryRouter>
      <SignupModal onClose={onClose} onSwitchToLogin={onSwitch} />
    </MemoryRouter>,
  );
  return { user: userEvent.setup(), onClose, onSwitch };
}

const fill = async (user: ReturnType<typeof userEvent.setup>, email: string, pw: string) => {
  if (email) await user.type(screen.getByLabelText(/email address/i), email);
  if (pw) await user.type(screen.getByLabelText(/^password/i), pw);
  await user.click(screen.getByRole('button', { name: /create account/i }));
};

beforeEach(() => {
  useAuthStore.getState().clearAuth();
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
});

describe('SignupModal', () => {
  it('shows validation errors and makes no request for empty/invalid input', async () => {
    const calls = mockHttp(() => ({ status: 500 }));
    const { user } = setup();
    await fill(user, 'not-an-email', 'short');
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters and include a letter and a number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(0);
  });

  it('shows live password rule feedback', async () => {
    mockHttp(() => ({ status: 500 }));
    const { user } = setup();
    await user.type(screen.getByLabelText(/^password/i), 'abcdefgh1');
    expect(screen.getByText(/strength: fair/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 1 number/i)).toBeInTheDocument();
  });

  it('maps EMAIL_EXISTS to an inline email error', async () => {
    mockHttp(() => apiError(409, 'EMAIL_EXISTS'));
    const { user } = setup();
    await fill(user, 'a@b.co', 'abcdefg1');
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('displays server VALIDATION_ERROR message', async () => {
    mockHttp(() => apiError(422, 'VALIDATION_ERROR', 'Password too common'));
    const { user } = setup();
    await fill(user, 'a@b.co', 'abcdefg1');
    expect(await screen.findByText('Password too common')).toBeInTheDocument();
  });

  it('shows a friendly error when the server is unreachable', async () => {
    mockHttp(() => {
      throw new Error('unreachable');
    });
    const { user } = setup();
    await fill(user, 'a@b.co', 'abcdefg1');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('stores the session and uploads a pending CV after successful signup', async () => {
    const calls = mockHttp(({ url }) =>
      url === '/api/auth/signup'
        ? { status: 201, data: { access_token: 'tok', token_type: 'bearer', user: sampleUser } }
        : { status: 201, data: { id: 'c1' } },
    );
    useUploadStore.getState().setPendingFile(new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
    const { user } = setup();
    await fill(user, 'a@b.co', 'abcdefg1');
    await waitFor(() => expect(useUploadStore.getState().status).toBe('done'));
    expect(useAuthStore.getState().token).toBe('tok');
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/signup', '/api/cv/upload']);
    expect(calls[1].auth).toBe('Bearer tok');
    expect(useUploadStore.getState().pendingFile).toBeNull();
  });
});
