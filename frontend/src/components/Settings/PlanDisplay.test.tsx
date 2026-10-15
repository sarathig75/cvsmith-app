import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import { PricingPage } from '../../pages/PricingPage';
import { ProtectedRoute } from '../Common/ProtectedRoute';
import { mockHttp, sampleUser } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';

const proUser = { ...sampleUser, plan: 'pro' as const };
const proQuota = { plan: 'pro', limit: 50, used: 3, remaining: 47, resets_at: '2026-11-01T00:00:00+00:00' };

function at(path: string) {
  const calls = mockHttp((req) =>
    req.url === '/api/user' ? { status: 200, data: proUser } : req.url === '/api/suggestions/quota' ? { status: 200, data: proQuota } : { status: 204 },
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Route>
        <Route path="/" element={<h1>Start page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}

beforeEach(() => {
  // The stored user still says "free": the pages must read the plan from the server.
  useAuthStore.setState({ user: sampleUser, token: 't', sessionExpired: false } as never);
});

describe('plan shown from the server', () => {
  it('Settings shows Pro and the suggestions left after a plan change', async () => {
    at('/settings');
    expect(await screen.findByText('Current plan: Pro')).toBeInTheDocument();
    expect(screen.getByText(/47 of 50 AI suggestions left this month \(renews (1 November|November 1)\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Upgrade to Pro/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your CV' })).toBeInTheDocument();
  });

  it('Pricing marks Pro as the current plan and lists the real Pro features', async () => {
    at('/pricing');
    const proCard = screen.getByRole('region', { name: 'Pro' });
    expect(await within(proCard).findByText('Your current plan')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Free' })).queryByText('Your current plan')).not.toBeInTheDocument();
    expect(screen.getByText('Export your CV as JSON Resume')).toBeInTheDocument();
    expect(screen.queryByText('Priority support')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upgrade Now/ })).not.toBeInTheDocument();
  });

  it('logs out from the header', async () => {
    const calls = at('/pricing');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Start page' })).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
    expect(calls.some((c) => c.url === '/api/auth/logout')).toBe(true);
  });
});
