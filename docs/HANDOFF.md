# CVSmith handoff

Updated: 2026-10-13 · main contains all work below (merged from `claude/trusting-darwin-wwr74d`;
see `git log` for the latest commit).

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
- Work entries have "I currently work here" (end date shown as "Present"). Parser sets
  `work[].current` only when the CV explicitly says the role is ongoing.
- Release 2: current-employer shield for recruiter search (see Release 2 roadmap in
  docs/CVSmith_Release_1_FINAL_PLAN.md; design points still open).

## Current state
- Backend: pytest 63/63 passing, flake8 clean.
- Frontend: type-check clean, vitest 42/42 passing, `vite build` OK.
- End-to-end run (API + real Redis + real Celery worker, Claude faked) succeeded: upload
  responds in ~0.02s, parsed data stored. With Redis down, upload still succeeds and the
  CV shows a clear "please upload again" error.
- **Not yet tested against the real Claude API** (key not yet visible in a session; see Setup notes).
- Open branches / PRs: none (session branch fully merged into main).

## Done this session
- Restored session-1 scaffold from the git bundle; pushed `main` (d15b2d5).
- Got all checks green; fixed verify-email link to `/verify` (3021a55, merged).
- Added handoff note + `handoff` skill (4059506, merged).
- Google account-linking fix, option A (49b5f35).
- Week 3–4 CV parsing, backend + frontend (973ea8f).
- Date pickers with "Years only" and CV-email preference (aaef571).
- "I currently work here" + explicit `current` flag in parsing; employer shield planned (c0412be).

## Next steps
1. Confirm the key is visible as `CVSMITH_CLAUDE_KEY` and works (one tiny test request).
2. Run 3–5 real CVs (text PDF, Word, scanned PDF, two-column layout) through the parser and
   check the results by eye. Needs the key; costs a few cents.
3. Then Week 5–6: save canvas edits to the backend (PATCH /api/cv), live PDF preview.

## Open questions for the user
- Key exists; verify it in a new session (see Setup notes for the variable name).
- Sonnet vs Opus: no measured comparison yet. Proposal: when the key exists, parse the same
  5 CVs with both models and compare side by side (well under $1). Approve?

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests need no Postgres, Redis or API key (all faked).
- Frontend: `cd frontend && npm install`.
- Parsing worker: Redis + `celery -A app.workers.celery_app worker` (see backend/README.md).
- API key: created by the user (Console key name `cvsmith-dev`, Default workspace, ~90-day
  expiry). In the Claude Code cloud environment it must be stored as the environment variable
  **`CVSMITH_CLAUDE_KEY`** (value without quotes): `ANTHROPIC_API_KEY` is not passed through
  there (the platform appears to reserve `ANTHROPIC_*`; it also sets its own
  `ANTHROPIC_BASE_URL`, which is why the app pins `CLAUDE_API_BASE_URL`). Locally or in Docker,
  `ANTHROPIC_API_KEY` works. Only new sessions see environment changes. Never paste or commit it.
- Full stack: `docker-compose.yml` (Postgres, Redis, backend, Celery worker, frontend);
  pass `ANTHROPIC_API_KEY` in the shell or a root `.env`.
