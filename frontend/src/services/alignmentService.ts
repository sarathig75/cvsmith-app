import { api } from './api';
import { download } from './cvService';
import type { Alignment, AtsScore, CV, Selection } from '../types';

/** Reads the job spec and scores the CV against it. Takes a few seconds (two AI steps). */
export const createAlignment = async (jobSpec: string) =>
  (await api.post<Alignment>('/api/alignment', { job_spec: jobSpec }, { timeout: 120000 })).data;

export const getAlignment = async (id: string) => (await api.get<Alignment>(`/api/alignment/${id}`)).data;

/** The Mode B score of the saved CV with the ticked changes (recomputed by the rules; nothing changes). */
export const previewAlignment = async (id: string, selection: Selection) =>
  (await api.post<AtsScore>(`/api/alignment/${id}/preview`, selection, { timeout: 60000 })).data;

/** Updates the saved CV with the ticked changes. */
export const applyAlignment = async (id: string, selection: Selection) =>
  (await api.post<CV>(`/api/alignment/${id}/apply`, selection)).data;

/** A PDF with the ticked changes for this job only; the saved CV stays as it is. */
export const downloadJobPdf = (id: string, selection: Selection) =>
  download(`/api/alignment/${id}/download`, 'CV.pdf', 60000, selection);
