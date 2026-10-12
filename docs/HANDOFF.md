# CVSmith handoff

Updated: 2026-10-12 · Last commit on main: 3021a55 fix: get scaffold checks green and reconcile verify-email link

## Product decisions (stable)
- Google sign-in only for social login (no Apple in Release 1).
- Pricing: Free = 1 suggestion/month, Pro = $9.99 for 50/month.
- New CVs are public by default; one CV per user (a new upload replaces the old one).
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- Branching: `main` plus short-lived `feature/*` branches.

## Current state
- Backend: pytest 39/39 passing, flake8 clean.
- Frontend: type-check clean, vitest 20/20 passing, `vite build` OK (React act() warnings only).
- Open branches / PRs: none besides `main` (session branch `claude/trusting-darwin-wwr74d` is merged).

## Done this session
- Restored the session-1 scaffold from a git bundle and pushed `main` (d15b2d5).
- Fixed email verification link: now `FRONTEND_URL/verify?token=` to match the frontend route (3021a55).
- Fixed a test that never exercised the "insecure JWT secret in production" check (3021a55).
- `.flake8` now excludes `.venv`; added `frontend/package-lock.json` (3021a55).
- Added this handoff note and the `handoff` skill (`.claude/skills/handoff/`).

## Next steps
1. Week 3–4: CV parsing. Text extraction (PDF/DOCX), Claude API call that returns
   JSON Resume, Celery worker, `parsing_status` transitions, frontend polling of `GET /api/cv`.
   Plan agreed with the user before coding; see open questions.

## Open questions for the user
- Google sign-in linking to an existing same-email password account: keep (and document in
  the contract, plus close the pre-registration hole) or refuse? Not yet decided.
- Parsing: which Claude model, and is an Anthropic API key available for real testing?

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests use SQLite; no Postgres/Redis needed to run them.
- Frontend: `cd frontend && npm install`.
- Full stack: `docker-compose.yml` (Postgres, Redis, backend, Celery worker, frontend).
