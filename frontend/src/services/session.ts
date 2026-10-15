import { api } from './api';
import { useAuthStore } from '../store/authStore';
import type { Token } from '../types';

/** Refresh at most this often, and only while the user is doing something. */
export const REFRESH_EVERY_MS = 60 * 60 * 1000;

/** When the token was issued (from its "iat" claim), in ms; 0 if unreadable. */
export function issuedAt(token: string): number {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { iat?: number }).iat! * 1000 || 0;
  } catch {
    return 0;
  }
}

let inFlight = false;

/** Called on user activity: swaps the token for a fresh 7-day one if it is over an hour old. */
export async function refreshIfDue(now = Date.now()): Promise<void> {
  const { token } = useAuthStore.getState();
  if (!token || inFlight || now - issuedAt(token) < REFRESH_EVERY_MS) return;
  inFlight = true;
  try {
    const res = (await api.post<Token>('/api/auth/refresh')).data;
    if (useAuthStore.getState().token === token) useAuthStore.getState().setAuth(res.access_token, res.user);
  } catch {
    /* a 401 ends the session (api interceptor); other errors: try again on the next activity */
  } finally {
    inFlight = false;
  }
}

/**
 * Keeps an active session alive: sessions end after 7 days without activity (the token's
 * lifetime), so the token is renewed while the user clicks or types. Returns a stop function.
 */
export function startSessionKeepAlive(): () => void {
  const onActivity = () => void refreshIfDue();
  const events = ['pointerdown', 'keydown'] as const;
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
  void refreshIfDue();
  return () => events.forEach((e) => window.removeEventListener(e, onActivity));
}
