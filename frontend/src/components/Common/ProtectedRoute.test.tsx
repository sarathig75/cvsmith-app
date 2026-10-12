import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { useAuthStore } from '../../store/authStore';
import { sampleUser } from '../../test/mockHttp';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<PublicOnlyRoute><div>onboarding page</div></PublicOnlyRoute>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/canvas" element={<div>canvas page</div>} />
          <Route path="/settings" element={<div>settings page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => useAuthStore.getState().clearAuth());

describe('route protection', () => {
  it('redirects unauthenticated visitors from /canvas to onboarding, with no nav', () => {
    renderAt('/canvas');
    expect(screen.getByText('onboarding page')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('renders protected pages with nav when authenticated', () => {
    useAuthStore.getState().setAuth('t', sampleUser);
    renderAt('/settings');
    expect(screen.getByText('settings page')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('sends logged-in users from / to /canvas', () => {
    useAuthStore.getState().setAuth('t', sampleUser);
    renderAt('/');
    expect(screen.getByText('canvas page')).toBeInTheDocument();
  });
});
