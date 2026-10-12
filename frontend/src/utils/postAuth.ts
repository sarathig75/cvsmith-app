import { useAuthStore } from '../store/authStore';
import { useUploadStore } from '../store/uploadStore';
import { uploadCv } from '../services/cvService';
import { parseApiError } from '../services/api';
import type { Token } from '../types';

/** Persist the session, then upload any CV chosen before signup (held in memory). Never throws. */
export async function completeAuth(token: Token): Promise<void> {
  useAuthStore.getState().setAuth(token.access_token, token.user);
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
