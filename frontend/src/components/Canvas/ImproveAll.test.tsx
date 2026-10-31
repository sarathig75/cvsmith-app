import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImproveAll } from './ImproveAll';
import { apiError, mockHttp } from '../../test/mockHttp';
import type { Handler } from '../../test/mockHttp';
import { emptyDraft } from '../../types/cvDraft';
import type { CvDraft } from '../../types/cvDraft';
import type { Quota, Suggestion, SuggestionRequest } from '../../types';

const draft: CvDraft = {
  ...emptyDraft('a@b.co'),
  personal: { ...emptyDraft().personal, headline: 'Analyst' },
  summary: 'Did lots of things.',
  experience: [
    { id: 'e1', title: 'Analyst', company: 'Acme', description: '• Did reports' },
    { id: 'e2', title: 'Intern', company: 'Beta', description: '• Did filing' },
  ],
};
const quota = (remaining: number): Quota => ({ plan: 'pro', limit: 50, used: 50 - remaining, remaining, resets_at: '' });

let n = 0;
const suggestion = (req: SuggestionRequest, over: Partial<Suggestion> = {}): Suggestion => ({
  id: `s${++n}`,
  field: req.field,
  entry_id: req.entry_id ?? null,
  original: req.text,
  suggested: `${req.text} (better)`,
  changed: true,
  status: 'pending',
  created_at: '',
  ...over,
});

function setup(handler: Handler, remaining = 47) {
  n = 0;
  const calls = mockHttp((req) => {
    if (req.method === 'patch') return { status: 200, data: {} };
    return handler(req);
  });
  const apply = vi.fn();
  const restore = vi.fn();
  const flush = vi.fn(async () => true);
  const onUsed = vi.fn();
  render(<ImproveAll draft={draft} quota={quota(remaining)} flush={flush} apply={apply} restore={restore} onUsed={onUsed} />);
  return { calls, apply, restore, flush, onUsed };
}
const ok: Handler = (req) => ({ status: 201, data: suggestion(req.data as SuggestionRequest) });

describe('Improve all', () => {
  it('asks first, naming how many suggestions it may use and how many are left', async () => {
    setup(ok);
    await userEvent.setup().click(screen.getByRole('button', { name: /Improve all/ }));
    expect(screen.getByText(/up to/)).toHaveTextContent('up to 4 suggestions');
    expect(screen.getByText(/You have/)).toHaveTextContent('47 of 50 left this month');
    expect(screen.queryByText(/run out part-way/)).not.toBeInTheDocument();
  });

  it('warns when it may run out of suggestions', async () => {
    setup(ok, 2);
    await userEvent.setup().click(screen.getByRole('button', { name: /Improve all/ }));
    expect(screen.getByText(/You may run out part-way/)).toBeInTheDocument();
  });

  it('asks nothing until the user confirms', async () => {
    const { calls } = setup(ok);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Improve all/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls).toHaveLength(0);
  });

  it('applies every changed suggestion, in order, saving first before the summary and headline', async () => {
    const { calls, apply, flush } = setup(ok);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Improve all/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/4 improvements applied/);
    const asked = calls.filter((c) => c.url === '/api/suggestions').map((c) => (c.data as SuggestionRequest).field);
    expect(asked).toEqual(['experience', 'experience', 'summary', 'headline']);
    expect(apply).toHaveBeenCalledTimes(4);
    expect(apply.mock.calls[0][1]).toBe('• Did reports (better)');
    expect(flush).toHaveBeenCalledTimes(2); // before the summary and before the headline
    const decisions = calls.filter((c) => c.method === 'patch').map((c) => (c.data as { status: string }).status);
    expect(decisions).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
  });

  it('does not apply a suggestion that mentions something not in the CV, and says so', async () => {
    const { apply } = setup((req) => {
      const r = req.data as SuggestionRequest;
      return { status: 201, data: suggestion(r, r.field === 'headline' ? { missing_details: ['Kubernetes'] } : {}) };
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Improve all/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/3 improvements applied, 1 need a detail from you/);
    expect(screen.getByText(/mentions Kubernetes, which is not in your CV/)).toBeInTheDocument();
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it('counts fields that are already fine as not used, and carries on after a failure', async () => {
    const { apply } = setup((req) => {
      const r = req.data as SuggestionRequest;
      if (r.entry_id === 'e1') return { status: 201, data: suggestion(r, { changed: false }) };
      if (r.field === 'summary') return apiError(503, 'SUGGESTION_FAILED', "We couldn't write a suggestion right now.");
      return ok(req);
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Improve all/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/2 improvements applied, 1 already in good shape, 1 not done/);
    expect(screen.getByText(/already in good shape \(not counted\)/)).toBeInTheDocument();
    expect(screen.getByText(/We couldn't write a suggestion right now/)).toBeInTheDocument();
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('stops when the monthly suggestions run out and lists what was not done', async () => {
    let asked = 0;
    const { apply } = setup((req) => {
      asked++;
      return asked === 2
        ? apiError(402, 'QUOTA_EXCEEDED', "You've used all 50 suggestions for this month.")
        : ok(req);
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Improve all/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/1 improvement applied, 3 not done/);
    expect(asked).toBe(2); // no more requests after the limit
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/You've used all 50 suggestions for this month/)).toHaveLength(3);
  });

  it('undoes everything: the earlier text returns and the suggestions are marked declined', async () => {
    const { calls, restore } = setup(ok);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Improve all/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(await screen.findByRole('button', { name: 'Undo all' }));
    expect(await screen.findByText('Your earlier text is back on every field.')).toBeInTheDocument();
    expect(restore).toHaveBeenCalledTimes(4);
    expect(restore.mock.calls.map((c) => c[1])).toEqual(['Analyst', 'Did lots of things.', '• Did filing', '• Did reports']); // last first
    const decisions = calls.filter((c) => c.method === 'patch').map((c) => (c.data as { status: string }).status);
    expect(decisions.filter((s) => s === 'declined')).toHaveLength(4);
  });

  it('has nothing to improve for an empty CV', async () => {
    mockHttp(() => ({ status: 200, data: {} }));
    render(
      <ImproveAll draft={emptyDraft('a@b.co')} quota={quota(50)} flush={async () => true} apply={vi.fn()} restore={vi.fn()} onUsed={vi.fn()} />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /Improve all/ }));
    expect(screen.getByText(/nothing to improve yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });
});
