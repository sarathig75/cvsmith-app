import { create } from 'zustand';
import type { User } from '../types';

export const AUTH_STORAGE_KEY = 'cvsmith_auth';

type Persisted = { token: string; user: User };

function read(): Persisted | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    return parsed && typeof parsed.token === 'string' && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

function write(value: Persisted | null) {
  try {
    if (value) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode etc.) - session stays in memory */
  }
}

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
};

const initial = read();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  setAuth: (token, user) => {
    write({ token, user });
    set({ token, user });
  },
  setUser: (user) => {
    const token = get().token;
    if (token) write({ token, user });
    set({ user });
  },
  clearAuth: () => {
    write(null);
    set({ token: null, user: null });
  },
}));

export const isAuthenticated = () => !!useAuthStore.getState().token;
