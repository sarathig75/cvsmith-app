import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import type { ApiErrorBody, ApiErrorCode } from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // Only treat 401 as "session expired" when we actually sent a token;
    // a 401 from /auth/login (INVALID_CREDENTIALS) must reach the form.
    const sentToken = !!error.config?.headers?.get?.('Authorization');
    if (error.response?.status === 401 && sentToken) {
      // Clearing auth makes ProtectedRoute redirect to "/".
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

export type ParsedApiError = { code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN'; message: string; status?: number };

export function parseApiError(err: unknown): ParsedApiError {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as Partial<ApiErrorBody> | undefined;
    if (body?.error?.code) {
      return { code: body.error.code, message: body.error.message, status: err.response?.status };
    }
    if (!err.response) {
      return { code: 'NETWORK_ERROR', message: 'Cannot reach the server. Check your connection and try again.' };
    }
    return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.', status: err.response.status };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
}
