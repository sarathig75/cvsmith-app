import { AUTH_STORAGE_KEY } from './authStore';
import { sampleUser } from '../test/mockHttp';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('authStore', () => {
  it('persists token and user to localStorage and restores them on load', async () => {
    const first = await import('./authStore');
    first.useAuthStore.getState().setAuth('tok123', sampleUser);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!)).toEqual({ token: 'tok123', user: sampleUser });

    vi.resetModules(); // simulates a page reload
    const second = await import('./authStore');
    expect(second.useAuthStore.getState().token).toBe('tok123');
    expect(second.useAuthStore.getState().user).toEqual(sampleUser);
  });

  it('clearAuth removes persisted state', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().setAuth('t', sampleUser);
    useAuthStore.getState().clearAuth();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('ignores corrupt storage', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{not json');
    const { useAuthStore } = await import('./authStore');
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('keeps working in memory when localStorage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { useAuthStore } = await import('./authStore');
    expect(() => useAuthStore.getState().setAuth('t', sampleUser)).not.toThrow();
    expect(useAuthStore.getState().token).toBe('t');
    spy.mockRestore();
  });
});
