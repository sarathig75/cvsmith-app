import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { mockHttp, sampleUser } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';
import { emptyDraft } from '../../types/cvDraft';
import type { CV } from '../../types';

const cv: CV = {
  id: 'cv1', title: 'My CV', privacy: 'public', parsing_status: 'not_uploaded', parsing_error: null,
  parsing_parts: { basics: 'complete', experience: 'complete', extras: 'complete' }, json_resume: {},
  content: { ...emptyDraft('a@b.co'), personal: { ...emptyDraft().personal, name: 'Jane Doe' }, summary: 'Hello.' },
  applied_parts: [], content_updated_at: null, created_at: '2026-01-01T00:00:00Z',
};

function open(plan: 'free' | 'pro') {
  useAuthStore.getState().setAuth('t', sampleUser);
  mockHttp((req) => {
    if (req.url === '/api/suggestions/quota') {
      return { status: 200, data: { plan, limit: plan === 'pro' ? 50 : 1, used: 0, remaining: plan === 'pro' ? 50 : 1, resets_at: '' } };
    }
    if (req.url === '/api/ats') return { status: 200, data: { before: null, after: null } };
    return { status: 200, data: cv };
  });
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CanvasPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Improve all on the Canvas', () => {
  it('is offered to Pro users', async () => {
    open('pro');
    expect(await screen.findByRole('button', { name: /Improve all/ })).toBeInTheDocument();
  });

  it('is not offered to Free users, who keep the one-field-at-a-time suggestions', async () => {
    open('free');
    await screen.findByLabelText('Full Name');
    expect(screen.queryByRole('button', { name: /Improve all/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Improve|Suggest/ }).length).toBeGreaterThan(0);
  });
});
