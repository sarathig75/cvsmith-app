import { create } from 'zustand';

/** In-memory only: a CV chosen on the onboarding screen before signup, and the post-auth upload status. */
type UploadState = {
  pendingFile: File | null;
  status: 'idle' | 'uploading' | 'done' | 'error';
  error: string | null;
  setPendingFile: (file: File | null) => void;
  setStatus: (status: UploadState['status'], error?: string | null) => void;
};

export const useUploadStore = create<UploadState>((set) => ({
  pendingFile: null,
  status: 'idle',
  error: null,
  setPendingFile: (pendingFile) => set({ pendingFile }),
  setStatus: (status, error = null) => set({ status, error }),
}));
