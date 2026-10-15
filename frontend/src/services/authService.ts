import { api } from './api';
import type { Token, User } from '../types';

/** Emails a 6-digit login code. The answer is the same whether or not an account exists. */
export const requestCode = async (email: string) =>
  (await api.post<{ message: string }>('/api/auth/code', { email })).data;
/** Logs in with the code; the first login creates the account. */
export const verifyCode = async (email: string, code: string) =>
  (await api.post<Token>('/api/auth/code/verify', { email, code })).data;
export const googleLogin = async (id_token: string) =>
  (await api.post<Token>('/api/auth/google', { id_token })).data;
export const logout = async () => {
  await api.post('/api/auth/logout');
};
export const getUser = async () => (await api.get<User>('/api/user')).data;
