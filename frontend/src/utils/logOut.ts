import { logout } from '../services/authService';
import { useAuthStore } from '../store/authStore';

/** Ends the session on this device (the token is discarded even if the server can't be reached). */
export async function logOut(): Promise<void> {
  try {
    await logout();
  } catch {
    /* discarded locally regardless */
  }
  useAuthStore.getState().clearAuth();
}
