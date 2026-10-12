import axios from 'axios';
import { api } from './api';
import type { CV } from '../types';

export const uploadCv = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return (await api.post<CV>('/api/cv/upload', form)).data;
};

/** Returns null when the user has no CV yet (404 NOT_FOUND). */
export const getCv = async (): Promise<CV | null> => {
  try {
    return (await api.get<CV>('/api/cv')).data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
};
