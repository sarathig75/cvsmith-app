import axios from 'axios';
import { api } from './api';
import type { CV, CVSave } from '../types';


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

/** Saves the canvas; creates the CV for a user who never uploaded a file. */
export const saveCv = async (body: CVSave) => (await api.patch<CV>('/api/cv', body)).data;

export const setPrivacy = async (privacy: CV['privacy']) => (await api.patch<CV>('/api/cv/privacy', { privacy })).data;

/** "Jane Doe CV.pdf" from the response header (UTF-8 form first), else the fallback. */
export function fileNameFrom(disposition: string | undefined, fallback: string): string {
  const utf8 = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      /* fall through */
    }
  }
  return disposition?.match(/filename="([^"]+)"/i)?.[1] || fallback;
}

/** Downloads a file from the API and hands it to the browser to save. */
async function download(url: string, fallbackName: string, timeout: number) {
  try {
    const res = await api.get<Blob>(url, { responseType: 'blob', timeout });
    const name = fileNameFrom(res.headers['content-disposition'] as string | undefined, fallbackName);
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return name;
  } catch (err) {
    // Error bodies of blob requests arrive as a Blob: read them so parseApiError sees the code.
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      try {
        err.response.data = JSON.parse(await err.response.data.text());
      } catch {
        /* not JSON: leave as is */
      }
    }
    throw err;
  }
}

/** The saved CV as a PDF in the Classic template (free for everyone). */
export const downloadPdf = () => download('/api/cv/download', 'CV.pdf', 60000);

/** The saved CV as JSON Resume (Pro only: fails with PRO_REQUIRED otherwise). */
export const exportJson = () => download('/api/cv/export', 'CV.json', 30000);
