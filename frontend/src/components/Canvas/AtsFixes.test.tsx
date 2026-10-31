import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CanvasPage } from './CanvasPage';
import { mockHttp, sampleUser } from '../../test/mockHttp';
import { useAuthStore } from '../../store/authStore';
import { emptyDraft } from '../../types/cvDraft';
import type { AtsCheck, AtsScore, CV } from '../../types';

const draft = {
  ...emptyDraft('a@b.co'),
  personal: { ...emptyDraft().personal, name: 'Jane Doe', headline: 'Analyst' },
  experience: [
    { id: 'e1', title: 'Analyst', company: 'Acme', start: '2019-03', end: '2021-06', description: '• Did reports' },
    { id: 'e2', title: 'Intern', company: 'Beta', start: '2018', end: '2019', yearOnly: 'true', description: '• Did filing' },
  ],
};
const cv: CV = {
  id: 'cv1', title: 'My CV', privacy: 'public', parsing_status: 'not_uploaded', parsing_error: null,
  parsing_parts: { basics: 'complete', experience: 'complete', extras: 'complete' }, json_resume: {},
  content: draft, applied_parts: [], content_updated_at: null, created_at: '2026-01-01T00:00:00Z',
};

const fail = (over: Partial<AtsCheck>): AtsCheck => ({
  id: 'A3', label: 'Contact details complete', passed: false, points: 7, max: 11, fix: 'Add your phone.',
  group: 'searchability', fix_kind: 'go_contact', ...over,
});
const ats: AtsScore = {
  score: 60,
  framework: 'ats-framework-v2',
  first_fix: null,
  checks: [
    fail({}),
    fail({ id: 'A5', label: 'Consistent dates', fix: 'Use one date format throughout.', fix_kind: 'dates_format' }),
    fail({ id: 'A7', label: 'Achievements have numbers', fix: 'Add numbers.', group: 'writing', fix_kind: 'go_experience' }),
    fail({ id: 'A6', label: 'Bullets start with a strong verb', fix: 'Use action verbs.', group: 'writing', fix_kind: 'improve_wording' }),
  ],
  groups: [
    { key: 'searchability', label: 'Searchability', points: 20, max: 32, percent: 62, issues: 2 },
    { key: 'writing', label: 'Writing', points: 10, max: 20, percent: 50, issues: 2 },
  ],
};

function open(plan: 'free' | 'pro' = 'free') {
  useAuthStore.getState().setAuth('t', sampleUser);
  const calls = mockHttp((req) => {
    if (req.url === '/api/suggestions/quota') {
      return { status: 200, data: { plan, limit: plan === 'pro' ? 50 : 1, used: 0, remaining: 1, resets_at: '' } };
    }
    if (req.url === '/api/ats') return { status: 200, data: { before: null, after: ats } };
    return { status: 200, data: cv };
  });
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CanvasPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return calls;
}

const saved = (calls: { method: string; data: unknown }[]) =>
  calls.filter((c) => c.method === 'patch').map((c) => c.data as { content: { experience: { start: string; end: string; yearOnly: string }[] } });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Fixes offered by the ATS score panel', () => {
  it('"Fix all" shows every date as the year only, saves it, and can be undone', async () => {
    const calls = open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Fix all' }, { timeout: 4000 }));
    expect(await screen.findByText(/Every date now shows the year only\./)).toBeInTheDocument();
    await vi.waitFor(() => expect(saved(calls).at(-1)?.content.experience[0]).toMatchObject({ start: '2019', end: '2021', yearOnly: 'true' }), {
      timeout: 4000,
    });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(saved(calls).at(-1)?.content.experience[0]).toMatchObject({ start: '2019-03', end: '2021-06' }), {
      timeout: 4000,
    });
    expect(screen.queryByText(/Every date now shows the year only/)).not.toBeInTheDocument();
  }, 15000);

  it('the date issue has its own button that does the same', async () => {
    const calls = open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '2 issues to fix in Searchability' }, { timeout: 4000 }));
    await user.click(screen.getByRole('button', { name: 'Show years only on every date' }));
    await vi.waitFor(() => expect(saved(calls).at(-1)?.content.experience[0].start).toBe('2019'), { timeout: 4000 });
  });

  it('a contact issue jumps to the contact details and focuses the first empty field', async () => {
    open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '2 issues to fix in Searchability' }, { timeout: 4000 }));
    await user.click(screen.getByRole('button', { name: 'Go to contact details' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toHaveValue('');
    expect(document.activeElement?.closest('section')).toHaveAttribute('data-preview-target', 'personal');
  });

  it('numbers can only come from the user: the button jumps to work experience, nothing is changed', async () => {
    const calls = open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '2 issues to fix in Writing' }, { timeout: 4000 }));
    await user.click(screen.getByRole('button', { name: 'Go to work experience' }));
    expect(document.activeElement?.closest('[data-preview-target="experience"]')).not.toBeNull();
    expect(saved(calls)).toHaveLength(0);
  });

  it('a Free user is sent to the job descriptions to use 💡 for wording issues; there is no Improve all', async () => {
    open('free');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '2 issues to fix in Writing' }, { timeout: 4000 }));
    expect(screen.getByRole('button', { name: /Go to the job descriptions/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Improve all/ })).not.toBeInTheDocument();
  });

  it('a Pro user gets Improve all in the panel, and the wording issue opens its confirm step', async () => {
    open('pro');
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Improve all/ });
    await user.click(screen.getByRole('button', { name: '2 issues to fix in Writing' }));
    const fixButton = screen.getAllByRole('button', { name: /Improve all/ }).find((b) => b.textContent === 'Improve all');
    await user.click(fixButton!);
    expect(await screen.findByText(/This asks for up to/)).toBeInTheDocument();
  });
});
