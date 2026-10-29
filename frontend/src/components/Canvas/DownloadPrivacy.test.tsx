import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { apiError, mockHttp, sampleUser } from '../../test/mockHttp';
import type { Handler } from '../../test/mockHttp';
import { fileNameFrom } from '../../services/cvService';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { emptyDraft } from '../../types/cvDraft';
import type { CV } from '../../types';

const cv: CV = {
  id: 'cv1', title: 'My CV', privacy: 'public', parsing_status: 'not_uploaded', parsing_error: null,
  parsing_parts: { basics: 'complete', experience: 'complete', extras: 'complete' }, json_resume: {},
  content: { ...emptyDraft('a@b.co'), personal: { ...emptyDraft().personal, name: 'Jane Doe' } },
  applied_parts: [], content_updated_at: null, created_at: '2026-01-01T00:00:00Z',
};

function setup(handler: Handler) {
  const calls = mockHttp((req) => {
    if (req.url === '/api/ats') return { status: 200, data: { before: null, after: null } };
    if (req.url === '/api/suggestions/quota') return { status: 200, data: { plan: 'free', limit: 1, used: 0, remaining: 1, resets_at: '' } };
    const reply = handler(req);
    return reply.status ? reply : { status: 200, data: cv };
  });
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CanvasPage />} />
        <Route path="/pricing" element={<h1>Pricing page</h1>} />
        <Route path="/next" element={<h1>What next page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}
const pass = { status: 0 };

let saved: { name: string; href: string }[] = [];
beforeEach(() => {
  useAuthStore.setState({ user: sampleUser, token: 't' } as never);
  useUploadStore.setState({ pendingFile: null, status: 'idle', error: null });
  saved = [];
  URL.createObjectURL = vi.fn(() => 'blob:cv');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ name: this.download, href: this.href });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Download PDF, Export JSON and visibility', () => {
  it('saves unsaved edits first, then downloads the PDF under the CV name', async () => {
    const calls = setup((req) =>
      req.url === '/api/cv/download'
        ? { status: 200, data: new Blob(['%PDF']) }
        : pass,
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Full Name'), ' Smith');
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    const order = calls.filter((c) => c.method === 'patch' || c.url === '/api/cv/download').map((c) => c.url);
    expect(order).toEqual(['/api/cv', '/api/cv/download']); // the edit is saved before the PDF is made
    expect((calls.find((c) => c.method === 'patch')?.data as { content: { personal: { name: string } } }).content.personal.name).toBe('Jane Doe Smith');
    expect(saved[0]).toEqual({ name: 'CV.pdf', href: 'blob:cv' });
    // After every download the user lands on the "what next" page.
    expect(await screen.findByRole('heading', { name: 'What next page' })).toBeInTheDocument();
  });

  it('shows the error when the PDF cannot be made', async () => {
    setup((req) => (req.url === '/api/cv/download' ? apiError(503, 'PDF_FAILED', "We couldn't create your PDF right now.") : pass));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't create your PDF right now.");
    expect(saved).toHaveLength(0);
  });

  it('offers Pro when a free user exports JSON', async () => {
    const message = 'JSON export is part of Pro. Upgrade to Pro for JSON export and 50 suggestions a month ($9.99/month).';
    setup((req) => (req.url === '/api/cv/export' ? apiError(402, 'PRO_REQUIRED', message) : pass));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Export JSON' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upgrade to Pro' });
    expect(dialog).toHaveTextContent(message);
    await user.click(within(dialog).getByRole('link', { name: 'See Pro plans' }));
    expect(await screen.findByRole('heading', { name: 'Pricing page' })).toBeInTheDocument();
  });

  it('saves the visibility setting and puts it back if saving fails', async () => {
    let fail = false;
    const calls = setup((req) =>
      req.url === '/api/cv/privacy' ? (fail ? apiError(500, 'SERVER_ERROR') : { status: 200, data: { ...cv, privacy: 'private' } }) : pass,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: '🔒 Private' }));
    expect(calls.find((c) => c.url === '/api/cv/privacy')?.data).toEqual({ privacy: 'private' });
    expect(screen.getByRole('radio', { name: '🔒 Private' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('🔒 Private', { selector: 'span' })).toBeInTheDocument(); // badge

    fail = true;
    await user.click(screen.getByRole('radio', { name: '🌍 Public' }));
    expect(await screen.findByText(/couldn't save your visibility setting/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '🔒 Private' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('fileNameFrom', () => {
  it('prefers the UTF-8 name', () => {
    expect(fileNameFrom(`attachment; filename="Jane ngstrm CV.pdf"; filename*=UTF-8''Jane%20%C3%85ngstr%C3%B6m%20CV.pdf`, 'CV.pdf')).toBe(
      'Jane Ångström CV.pdf',
    );
    expect(fileNameFrom('attachment; filename="CV.json"', 'x')).toBe('CV.json');
    expect(fileNameFrom(undefined, 'CV.pdf')).toBe('CV.pdf');
  });
});
