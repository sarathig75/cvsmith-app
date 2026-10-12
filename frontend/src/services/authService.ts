import { api } from './api';
import type { Credentials, Token, User } from '../types';

export const signup = async (c: Credentials) => (await api.post<Token>('/api/auth/signup', c)).data;
export const login = async (c: Credentials) => (await api.post<Token>('/api/auth/login', c)).data;
export const googleLogin = async (id_token: string) =>
  (await api.post<Token>('/api/auth/google', { id_token })).data;
export const logout = async () => {
  await api.post('/api/auth/logout');
};
export const getUser = async () => (await api.get<User>('/api/user')).data;
export const sendVerification = async () =>
  (await api.post<{ message: string }>('/api/auth/send-verification')).data;
export const verifyEmail = async (token: string) => (await api.post<User>('/api/auth/verify', { token })).data;
