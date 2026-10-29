import { api } from './api';
import type { AtsPair, Dashboard } from '../types';

export const getDashboard = async () => (await api.get<Dashboard>('/api/dashboard', { timeout: 60000 })).data;

/** The ATS score before (uploaded file) and after (saved CV). Rendering the PDF can take a few seconds. */
export const getAtsScores = async () => (await api.get<AtsPair>('/api/ats', { timeout: 60000 })).data;

/** Funnel step only: the user reached the "what next" page. A failure is ignored by the caller. */
export const markNextViewed = async () => {
  await api.post('/api/next/viewed');
};
