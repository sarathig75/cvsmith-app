# CVSmith handoff

Updated: 2026-10-16 · Last commit on main: this note's commit (summary 💡 rule, missing-key errors,
local setup guide). Everything is merged. Pilot not deployed yet.

## Product decisions (stable)
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- **Login = one-time 6-digit email code**; no passwords in Release 1 (code kept, off via
  `PASSWORD_LOGIN_ENABLED`). Google sign-in stays. SMS/phone login rejected (cost, DLT, abuse).
- Email: Resend free plan (3,000/month, 100/day) over SMTP; `EMAIL_PROVIDER` = log|sendgrid|smtp.
- Sessions end after 7 days without activity; unsaved edits are kept and offered back.
- Pricing: Free 1 suggestion/month, Pro $9.99 for 50/month (calendar month, UTC). PDF free; JSON
  export Pro only. Pro can't be bought yet (Week 10).
- One CV per user, public by default ("Public" is a flag until recruiter search, Release 2).
  "Upload new CV" replaces it after a warning; versions come later. PDF/DOCX uploads only;
  the uploaded file is deleted once parsed.
- Parsing keeps the candidate's wording (`claude-sonnet-5-5`). Writing rules apply to 💡 only:
  master `.claude/skills/cv-house-style/SKILL.md`, copy in `backend/app/prompts/` (test-synced).
- 💡 on Headline, Summary, job and project descriptions; small edits = "no change" (not counted).
- 💡 Summary: an existing summary is only reworded (it may be a positioning statement for the
  next role; objectives too); an empty one is written from roles, education, skills and
  job/project descriptions (decided 2026-10-16).
- Canvas: five groups, entries move up/down; one Classic template for preview and PDF
  (`CvTemplate.{tsx,css}`, printed from `frontend/print.html` by headless Chromium).
- Pilot: ≤25 testers in India, invited emails only (`INVITE_ONLY`; `python -m app.cli invites
  add …`), one server running `deploy/docker-compose.prod.yml` (Hetzner Singapore planned; nothing
  is provider-specific, the host may change). Guide: `docs/DEPLOY.md`.
- Start page: "Built for AI screening. Polished by AI. Still 100% you." + How it works (3 steps),
  before/after example (invented sample, `components/Landing/`), sign-up card. Claim only what
  works today: ATS/AI-readable, AI suggestions; no recruiter search until Release 2.
- Drop-off metrics in our own `events` table (`docs/FUNNEL.md`), never CV content.

## Current state
- Backend: pytest 156/156, flake8 clean; migrations up to 0008 (SQLite + Postgres).
- Frontend: type-check clean, vitest 95/95, build OK. CI (GitHub Actions) runs on every push.
- Open branches / PRs: none open; session branches `claude/clever-meitner-049zyv` and
  `claude/serene-thompson-8hp7uo` are fully merged.
- User now runs the app locally on a new Windows PC with Docker (`docs/LOCAL_SETUP.md`); upload
  and parsing confirmed working there; rest of the 3.2 checklist not yet reported.
- Production setup rehearsed without Docker (production build behind Caddy, production-mode API,
  invite-only, code over SMTP, PDF, real client IP, backup restore). The Docker production stack
  runs for the first time on the real server.
- Privacy notice: DRAFT at `/privacy` (linked from start page and Settings) and in
  `docs/PRIVACY_DRAFT.md`, with placeholders listed; a test keeps both copies equal.

## Done this session
- `docs/LOCAL_SETUP.md`: step-by-step Windows + Docker guide (setup, testing, troubleshooting).
- A missing Claude API key now logs "No Claude API key configured" and fails parsing/💡 cleanly
  instead of a generic error (cause of the user's first local failure: `.env` not read).
- 💡 Summary rule above, in `cv-house-style` (skill + backend copy) and the suggestion prompt;
  checked against the real API (positioning kept, empty summary written from facts).

## Next steps
0. User finishes the local checklist (`docs/LOCAL_SETUP.md` 3.2), incl. 💡 on an empty and a
   positioning-style summary; fix what they report.
1. User decides the domain and the privacy details (operator, contact, applicable law); Claude
   fills the placeholders (`frontend/src/pages/privacyText.ts`, then
   `cd frontend && npx vite-node scripts/privacy-md.ts`).
2. Pilot go-live together, following `docs/DEPLOY.md`: domain, server, DNS, Resend, Google
   origin, `sudo ./deploy/setup.sh`, invite testers.
3. Week 10: billing (Stripe checkout and webhooks, Pro upgrade, receipts, admin dashboard).
4. Open: the user's scanned-CV check; parsing puts employer-wide bullets under the latest title;
   two open tabs = last write wins.

## Open questions for the user
- Which domain name?
- Privacy notice: operator name, contact email, applicable law.
- Re-upload the changed `cv-house-style` skill to claude.ai (zip given on 2026-10-16): confirm done.

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests fake Postgres, Redis, email, Chromium and Claude: check AI changes against the real API.
- Frontend: `cd frontend && npm install`. Worker: `celery -A app.workers.celery_app worker`.
- PDF needs Chromium (`playwright install chromium` or `PDF_CHROMIUM_PATH`; cloud container:
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) and the frontend at `PDF_TEMPLATE_URL`.
- API key: `CVSMITH_CLAUDE_KEY` in the Claude Code cloud environment, `ANTHROPIC_API_KEY` in the
  root `.env` for Docker. Never commit or print keys.
- Local Docker on Windows, step by step: `docs/LOCAL_SETUP.md`.
- Local Docker (user's Windows machine): login codes appear in `docker compose logs backend
  --tail 20`. After code changes `docker compose restart`; after Dockerfile/requirements changes
  `docker compose up -d --build`. If `.env` isn't read: save it as UTF-8 without BOM.
  Make a test account Pro: `docker compose exec postgres psql -U cvsmith_user -d cvsmith_db -c
  "update users set plan='pro' where lower(email)=lower('...')"`.
- Cloud container (no Docker): Postgres 16 in `/tmp/cvsmith-pg/data` port 5433 (`pg_ctl` as
  `postgres`; remove stale `.s.PGSQL.5433*` first), `redis-server --daemonize yes`,
  `alembic upgrade head`, uvicorn (no reload: restart after backend changes), worker, `npx vite`.
- Test CVs are real people's CVs in the user's Drive folder "CVSmith": never commit them or
  their contents; use invented data for screenshots.
- `cv-house-style` also lives in the user's claude.ai account: after a rule change, update the
  backend copy, zip the skill, and ask the user to re-upload it.
