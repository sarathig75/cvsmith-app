# CVSmith handoff

Updated: 2026-10-13 · Last commit on main: 4059506 docs: add handoff note and handoff skill
Unmerged work: branch `claude/trusting-darwin-wwr74d` (4 commits ahead of main, see below).
Note: read this file from that branch until it is merged; main still has the older note.

## Product decisions (stable)
- Google sign-in only for social login (no Apple in Release 1).
- Pricing: Free = 1 suggestion/month, Pro = $9.99 for 50/month.
- New CVs are public by default; one CV per user (a new upload replaces the old one).
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- Branching: `main` plus short-lived `feature/*` branches.
- Google sign-in links to an existing same-email account; if that account's email was never
  verified, its password is removed (closes the "pre-registered email" takeover hole).
- CV parsing model: `claude-sonnet-5-5` (user's rule: use Sonnet unless Opus is qualitatively
  better). Changeable via the `CLAUDE_MODEL` env var without code changes.
- Parsing UX: upload never waits; canvas is editable immediately; parsed data fills only the
  fields the user left empty (user edits always win).
- Exception: the email from the CV replaces the pre-filled account email (people use different
  addresses for applications); an email the user typed is kept.
- Dates: Month + Year dropdowns, with one "Years only (hide months)" checkbox per entry.
  Stored as "YYYY-MM" or "YYYY". Year-only CVs show years with the box pre-ticked.

## Current state
- Backend: pytest 61/61 passing, flake8 clean.
- Frontend: type-check clean, vitest 39/39 passing, `vite build` OK.
- End-to-end run (API + real Redis + real Celery worker, Claude faked) succeeded: upload
  responds in ~0.02s, parsed data stored. With Redis down, upload still succeeds and the
  CV shows a clear "please upload again" error.
- **Not yet tested against the real Claude API** (no `ANTHROPIC_API_KEY` in this environment).
- Open branches / PRs: `claude/trusting-darwin-wwr74d` → not merged, no PR. Contains:
  - 49b5f35 fix(auth): drop unverified password when Google links an account
  - 973ea8f feat: background CV parsing with Claude and live canvas pre-fill
  - b67c5e4 docs: update handoff with parsing work and open decisions
  - aaef571 feat(canvas): month/year date pickers with "Years only", prefer CV email

## Done this session
- Restored session-1 scaffold from the git bundle; pushed `main` (d15b2d5).
- Got all checks green; fixed verify-email link to `/verify` (3021a55, merged).
- Added handoff note + `handoff` skill (4059506, merged).
- Google account-linking fix, option A (49b5f35, on branch).
- Week 3–4 CV parsing, backend + frontend (973ea8f, on branch).
- Date pickers with "Years only" and CV-email preference (aaef571, on branch).

## Next steps
1. User: create an Anthropic API key and add it to the environment (see Setup notes).
2. Run 3–5 real CVs (text PDF, Word, scanned PDF, two-column layout) through the parser and
   check the results by eye. Needs the key; costs a few cents.
3. Merge `claude/trusting-darwin-wwr74d` into `main` once the user approves.
4. Then Week 5–6: save canvas edits to the backend (PATCH /api/cv), live PDF preview.

## Open questions for the user
- Waiting on the user: Anthropic API key (they will say when it is created).
- Merge the branch into `main` now, or after the real-CV check in step 2?
- Sonnet vs Opus: no measured comparison yet. Proposal: when the key exists, parse the same
  5 CVs with both models and compare side by side (well under $1). Approve?
- Idea raised with the user, no answer yet: a "Currently work here" checkbox so a current
  role shows "– Present" instead of an empty end date.

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests need no Postgres, Redis or API key (all faked).
- Frontend: `cd frontend && npm install`.
- Parsing worker: Redis + `celery -A app.workers.celery_app worker` (see backend/README.md).
- API key: create at console.anthropic.com (sign in → add billing credit → API Keys → Create
  Key). Add it as the environment variable `ANTHROPIC_API_KEY` in the cloud environment
  settings (environment menu in the session title bar → Edit), or in `backend/.env` locally.
  Never paste it into chat or commit it.
- Full stack: `docker-compose.yml` (Postgres, Redis, backend, Celery worker, frontend);
  pass `ANTHROPIC_API_KEY` in the shell or a root `.env`.
