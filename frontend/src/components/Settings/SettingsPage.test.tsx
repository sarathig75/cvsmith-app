import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import { mockHttp, sampleUser } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';

function setup() {
  const calls = mockHttp((req) =>
    req.url === '/api/user' && req.method === 'get' ? { status: 200, data: sampleUser } : { status: 204 },
  );
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<h1>Start page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: sampleUser, token: 't', sessionExpired: false } as never);
});

describe('Settings danger zone', () => {
  it('deletes the CV after confirming and keeps the user logged in', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete my CV' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your CV?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete my CV' }));
    expect(await screen.findByText(/Your CV was deleted/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'delete' && c.url === '/api/cv')).toBe(true);
    expect(useAuthStore.getState().token).toBe('t');
  });

  it('deletes the account only after typing DELETE, then logs out', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(confirm);
    expect(await screen.findByRole('heading', { name: 'Start page' })).toBeInTheDocument();
    const del = calls.find((c) => c.method === 'delete' && c.url === '/api/user');
    expect(del?.data).toEqual({ confirm: 'DELETE' });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('cancelling deletes nothing', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete my CV' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'delete')).toBe(false);
  });
});
