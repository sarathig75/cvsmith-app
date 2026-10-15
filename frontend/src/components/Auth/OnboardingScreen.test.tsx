import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingScreen } from './OnboardingScreen';
import { useAuthStore } from '../../store/authStore';

const renderStart = () =>
  render(
    <MemoryRouter>
      <OnboardingScreen />
    </MemoryRouter>,
  );

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe('start page', () => {
  it('states the value proposition and how it works', () => {
    renderStart();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Built for AI screening. Polished by AI. Still 100% you.');
    expect(screen.getByText(/ATS-ready, AI-readable CV/)).toBeInTheDocument();
    const steps = screen.getByRole('heading', { name: 'How it works' }).nextElementSibling!;
    expect(steps.querySelectorAll('li')).toHaveLength(3);
    expect(steps).toHaveTextContent(/Upload\..*Improve with AI\..*Download\./);
    // one copy for wide screens, one for phones (CSS shows one)
    expect(screen.getAllByRole('figure', { name: /old CV becomes a clean CV/ })).toHaveLength(2);
    expect(screen.getByText(/Never invents facts/)).toBeInTheDocument();
  });

  it('opens the email code dialog', async () => {
    renderStart();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue with Email' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers only email when Google sign-in is not configured', () => {
    renderStart();
    expect(screen.queryByTestId('google-unconfigured')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'Or' })).not.toBeInTheDocument();
  });

  it('explains an expired session', () => {
    useAuthStore.setState({ sessionExpired: true });
    renderStart();
    expect(screen.getByRole('status')).toHaveTextContent(/Your session expired/);
  });
});
