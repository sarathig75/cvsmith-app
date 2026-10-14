import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { api } from '../services/api';

export type MockReply = { status: number; data?: unknown };
export type Handler = (req: { method: string; url: string; data: unknown; headers: InternalAxiosRequestConfig['headers'] }) => MockReply;

/** Replaces only the HTTP transport of the real axios instance; interceptors and services run for real. */
export function mockHttp(handler: Handler) {
  const calls: { method: string; url: string; data: unknown; auth?: string }[] = [];
  api.defaults.adapter = async (config) => {
    const method = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    let data: unknown = config.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* leave as is */ }
    }
    calls.push({ method, url, data, auth: config.headers?.get?.('Authorization') as string | undefined });
    const reply = handler({ method, url, data, headers: config.headers });
    const response: AxiosResponse = { data: reply.data, status: reply.status, statusText: '', headers: {}, config };
    if (reply.status >= 400) throw new AxiosError('fail', String(reply.status), config, null, response);
    return response;
  };
  return calls;
}

export const apiError = (status: number, code: string, message = 'msg'): MockReply => ({
  status,
  data: { error: { code, message } },
});

export const sampleUser = { id: 'u1', email: 'a@b.co', email_verified: false, plan: 'free' as const, created_at: '2026-01-01T00:00:00Z' };
