import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { mockHttp, sampleUser } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { emptyDraft } from '../../types/cvDraft';
import type { CV } from '../../types';

const saved: CV = {
  id: 'cv1', title: 'Old CV', privacy: 'public', parsing_status: 'complete', parsing_error: null,
  parsing_parts: { basics: 'complete', experience: 'complete', extras: 'complete' }, json_resume: {},
  content: { ...emptyDraft('a@b.co'), personal: { ...emptyDraft().personal, name: 'Old Name' } },
  applied_parts: ['basics', 'experience', 'extras'], content_updated_at: null, created_at: '2026-01-01T00:00:00Z',
};
const none: CV = { ...saved, parsing_status: 'not_uploaded', content: null, applied_parts: [] };
const pdf = () => new File(['%PDF-1.4'], 'new-cv.pdf', { type: 'application/pdf' });

function setup(initial: CV | null) {
  let cv = initial;
  const calls = mockHttp((req) => {
    if (req.url === '/api/suggestions/quota') return { status: 200, data: { plan: 'free', limit: 1, used: 0, remaining: 1, resets_at: '' } };
    if (req.method === 'post' && req.url === '/api/cv/upload') {
      cv = { ...saved, title: 'new-cv', parsing_status: 'pending', content: null, applied_parts: [],
             parsing_parts: { basics: 'pending', experience: 'pending', extras: 'pending' } };
      return { status: 201, data: cv };
    }
    if (req.url === '/api/cv' && req.method === 'get') return cv ? { status: 200, data: cv } : { status: 404, data: { error: { code: 'NOT_FOUND', message: 'x' } } };
    return { status: 200, data: cv };
  });
  render(
    <MemoryRouter>
      <CanvasPage />
    </MemoryRouter>,
  );
  return calls;
}

beforeEach(() => {
  useAuthStore.setState({ user: sampleUser, token: 't' } as never);
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
});

describe('Upload new CV', () => {
  it('replaces the current CV after a warning; "new version" is shown as coming soon', async () => {
    const calls = setup(saved);
    const user = userEvent.setup();
    expect(await screen.findByLabelText('Full Name')).toHaveValue('Old Name');
    await user.click(screen.getByRole('button', { name: 'Upload new CV' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload a new CV' });
    const upload = within(dialog).getByRole('button', { name: 'Upload and replace' });
    expect(upload).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: /Replace my current CV/ })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: /Create a new version/ })).toBeDisabled();

    await user.upload(within(dialog).getByTestId('replace-cv-input'), pdf());
    await user.click(upload);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'post' && c.url === '/api/cv/upload')).toBe(true));
    expect(await screen.findByLabelText('Full Name')).toHaveValue(''); // starts fresh from the new file
  });

  it('rejects a file that is not PDF or Word', async () => {
    setup(saved);
    const user = userEvent.setup({ applyAccept: false });
    await user.click(await screen.findByRole('button', { name: 'Upload new CV' }));
    const dialog = screen.getByRole('dialog');
    await user.upload(within(dialog).getByTestId('replace-cv-input'), new File(['x'], 'cv.pptx', { type: 'application/vnd.ms-powerpoint' }));
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Upload and replace' })).toBeDisabled();
  });

  it('offers an upload when the user has no CV yet', async () => {
    const calls = setup(none);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Upload your CV' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload your CV' });
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument(); // nothing to replace
    await user.upload(within(dialog).getByTestId('replace-cv-input'), pdf());
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }));
    await vi.waitFor(() => expect(calls.some((c) => c.url === '/api/cv/upload')).toBe(true));
  });
});
