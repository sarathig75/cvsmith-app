import { useAuthStore } from '../store/authStore';
import { useUploadStore } from '../store/uploadStore';
import { getCv, uploadCv } from '../services/cvService';
import { parseApiError } from '../services/api';
import type { Token } from '../types';

/**
 * Persist the session, then upload any CV chosen before signup (held in memory). Never throws.
 * A new upload replaces the user's saved CV and edits, so when they already have saved edits
 * (e.g. logging in with a file chosen) the upload waits for them to confirm on the canvas.
 */
export async function completeAuth(token: Token): Promise<void> {
  useAuthStore.getState().setAuth(token.access_token, token.user);
  const file = useUploadStore.getState().pendingFile;
  if (!file) return;
  try {
    const existing = await getCv();
    if (existing?.content) {
      useUploadStore.getState().setStatus('confirm');
      return;
    }
  } catch {
    // Could not check: ask rather than risk replacing saved edits.
    useUploadStore.getState().setStatus('confirm');
    return;
  }
  await uploadPendingFile();
}

/** Uploads the file chosen before signup/login (after confirmation if needed). Never throws. */
export async function uploadPendingFile(): Promise<void> {
  const upload = useUploadStore.getState();
  const file = upload.pendingFile;
  if (!file) return;
  upload.setStatus('uploading');
  try {
    await uploadCv(file);
    useUploadStore.getState().setStatus('done');
  } catch (err) {
    useUploadStore.getState().setStatus('error', parseApiError(err).message);
  } finally {
    useUploadStore.getState().setPendingFile(null);
  }
}

/** The user chose to keep their saved CV: forget the file. */
export function discardPendingFile(): void {
  useUploadStore.getState().setPendingFile(null);
  useUploadStore.getState().setStatus('idle');
}
