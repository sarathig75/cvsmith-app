import { api } from './api';
import type { Quota, Suggestion, SuggestionRequest } from '../types';

export const getQuota = async () => (await api.get<Quota>('/api/suggestions/quota')).data;

/** One AI rewrite of one field. Fails with QUOTA_EXCEEDED (402) when none are left this month. */
export const requestSuggestion = async (body: SuggestionRequest) =>
  // Writing a suggestion takes a few seconds; allow longer than the default timeout.
  (await api.post<Suggestion>('/api/suggestions', body, { timeout: 90000 })).data;

export const decideSuggestion = async (id: string, status: 'accepted' | 'declined') =>
  (await api.patch<Suggestion>(`/api/suggestions/${id}`, { status })).data;
