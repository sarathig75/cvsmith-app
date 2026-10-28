# CVSmith handoff

Updated: 2026-10-28 · Last commit on main: see `git log -1` (plan + journey docs, 2026-10-28).
Everything is merged. Pilot not deployed. Nothing from the 2026-10-23/28 plans is built yet.

## Product decisions (stable)
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- **Login = one-time 6-digit email code** + Google sign-in; no passwords in Release 1 (code kept,
  off via `PASSWORD_LOGIN_ENABLED`). SMS/phone login rejected (cost, DLT, abuse).
- Email: Resend free plan (3,000/month, 100/day) over SMTP; `EMAIL_PROVIDER` = log|sendgrid|smtp.
- Sessions end after 7 days without activity; unsaved edits are kept and offered back.
- Pricing: Free 1 suggestion/month, Pro $9.99 for 50/month (calendar month, UTC). PDF free; JSON
  export Pro only. Pro can't be bought yet (Week 10).
- One CV per user, public by default (a flag until recruiter search, Release 2). "Upload new CV"
  replaces it after a warning. PDF/DOCX only; the uploaded file is deleted once parsed.
- Parsing keeps the candidate's wording (`claude-sonnet-5-5`). Writing rules apply to 💡 only:
  master `.claude/skills/cv-house-style/SKILL.md`, copy in `backend/app/prompts/` (test-synced).
- 💡 on Headline, Summary, job and project descriptions; small edits = "no change" (not counted).
- 💡 Summary (2026-10-16): an existing summary is only reworded, content kept (it may be a
  positioning statement; objectives too); an empty one is written from roles, education,
  skills and job/project descriptions.
- Canvas: five groups, entries move up/down; one Classic template for preview and PDF.
- Pilot: ≤25 testers in India, invited emails only (`INVITE_ONLY`; `python -m app.cli invites
  add …`), one server running `deploy/docker-compose.prod.yml`. Guide: `docs/DEPLOY.md`.
- Start page claims only what works today (ATS/AI-readable, AI suggestions); no recruiter search.
- Drop-off metrics in our own `events` table (`docs/FUNNEL.md`), never CV content.

## Current state
- Backend: pytest 156/156, flake8 clean (run 2026-10-17); migrations up to 0008.
- Frontend: type-check clean, vitest 95/95, build OK (run 2026-10-17).
- Open branches / PRs: none; `claude/serene-thompson-8hp7uo` and `claude/clever-meitner-049zyv`
  are fully merged.
- User's new Windows PC runs the full Docker stack (`docs/LOCAL_SETUP.md`): email-code login,
  upload + parsing and Google sign-in confirmed working. Rest of checklist 3.2 not yet reported.
- Google sign-in: the user created an OAuth client (Web application) in Google Cloud on
  2026-10-17; consent screen in **Testing**, so only listed test users can sign in. Origin
  `http://localhost:5173` added; the production domain is not yet.
- Privacy notice: DRAFT at `/privacy` and `docs/PRIVACY_DRAFT.md`, placeholders still open.

## Done this session
- 2026-10-28: `docs/USER_JOURNEYS.md` (J1 new user, J2 returning user, dashboard, `/next`).
  Release plan scope updated (dashboard, `/next`, ATS, job alignment) and its "Dashboard" items
  corrected: they described the Canvas page.
- Mockups for review (sample data, not code): Canvas with job alignment, desktop + phone, v3:
  https://claude.ai/artifact/TDD8nQEuGeyhgcwmKvKDpZ
  Dashboard + `/next`, desktop + phone: https://claude.ai/artifact/4CzxsdYGX3LX2KAUooUS8K
- 2026-10-23: `local-troubleshoot` skill + diagnostic file (05f30f2); Google sign-in steps in
  `docs/LOCAL_SETUP.md` 1.7 (65a3f5a). The user re-uploaded `cv-house-style` to claude.ai.
- Missing Claude API key → clear log and parse/💡 failure (7f13e02).
- 💡 Summary rule: an existing summary is only reworded; an empty one is written from the CV (7f13e02).

## Next steps
1. User checks the local checklist (`docs/LOCAL_SETUP.md` 3.2) and reports what fails.
2. Build the agreed plan, in this order, with the contract (`docs/API_CONTRACT.md`) first:
   a. Dashboard `/dashboard` (home for logged-in users) and login routing (CV → dashboard;
      no CV → dashboard with upload prompt). Shows CV strength %, ATS current score, job-alignment
      panel, and the Download PDF / JSON cards. Source of truth: `docs/USER_JOURNEYS.md`.
   b. CV strength %: points per section (table in `docs/USER_JOURNEYS.md`; user must confirm).
   c. `/next` page after every download (four cards that open their page; never blocks a download).
   d. ATS format score: a fixed checklist; Canvas shows before (saved when the CV is parsed; the
      upload is deleted, so only the numbers and check names are kept) and after; dashboard shows
      current only. Heuristic checks (columns, tables) must be labelled as such.
   e. Job alignment (Pro, Sonnet, separate quota; sample result for Free users; spec deleted after).
   Gaps: MISSING = action; WEAK = "Addressed" by a suggestion; COVERED = none.
3. Phone mockups are reviewed (above). Approve the desktop and phone layouts before (a) starts.
4. Domain + privacy details from the user; Claude fills `frontend/src/pages/privacyText.ts`,
   then `cd frontend && npx vite-node scripts/privacy-md.ts`.
5. Pilot go-live per `docs/DEPLOY.md`; add `https://DOMAIN` to the OAuth client's origins and
   the pilot testers as Google test users (or publish the consent screen).
6. Week 10: billing (Stripe checkout and webhooks, Pro upgrade, receipts, admin dashboard).
7. Known issues: scanned-CV check; employer-wide bullets land under the latest title; two open
   tabs = last write wins.

## Open questions for the user
- Approve the dashboard and `/next` layouts (desktop + phone), and the sample numbers (64%, 78).
- CV strength points (`docs/USER_JOURNEYS.md`): confirm or change.
- Which domain name? Privacy notice: operator name, contact email, applicable law (still open).

## Setup notes
- Local problems: use the `local-troubleshoot` skill (symptom table + diagnostic file,
  `docs/LOCAL_SETUP.md` 5.1); add each newly solved problem to both.
- Local Docker on Windows: follow `docs/LOCAL_SETUP.md`. Root `.env` holds `ANTHROPIC_API_KEY`
  and `GOOGLE_OAUTH_CLIENT_ID`; write it with `-Encoding ascii`; after any `.env` change run
  `docker compose up -d` (restart does not re-read it). Codes: `docker compose logs backend`.
- Backend in the cloud container: `cd backend && python3.11 -m venv .venv && .venv/bin/pip
  install -r requirements.txt`. Tests fake Postgres, Redis, email, Chromium and Claude: check AI
  changes against the real API (`CVSMITH_CLAUDE_KEY` is set there). Never commit or print keys.
- Frontend: `cd frontend && npm install`. Worker: `celery -A app.workers.celery_app worker`.
- PDF needs Chromium (`PDF_CHROMIUM_PATH`; cloud: `/opt/pw-browsers/chromium-1194/chrome-linux/
  chrome`) and the frontend at `PDF_TEMPLATE_URL`.
- Cloud full stack (no Docker): Postgres 16 in `/tmp/cvsmith-pg/data` port 5433, `redis-server
  --daemonize yes`, `alembic upgrade head`, uvicorn, worker, `npx vite`.
- Test CVs are real people's CVs in the user's Drive folder "CVSmith": never commit them.
- `cv-house-style` also lives in the user's claude.ai account: after a rule change, update the
  backend copy, zip the skill, and ask the user to re-upload it.
