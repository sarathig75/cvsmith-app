# CVSmith handoff

Updated: 2026-10-15 · Everything is merged into main (fast-forward from the session branch
`claude/clever-meitner-049zyv`; this note is the last commit). Pilot not deployed yet.

## Product decisions (stable)
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- **Login = one-time 6-digit code by email** (decided 2026-10-15); no passwords in Release 1 (the
  code is kept, switched off by `PASSWORD_LOGIN_ENABLED`). Google sign-in stays. Phone/SMS login
  was considered and rejected (paid per SMS, DLT registration in India, abuse risk).
- Email: Resend (free: 3,000/month, 100/day) over SMTP for the pilot; provider is a setting,
  `EMAIL_PROVIDER` = log | sendgrid | smtp (SendGrid has no free plan any more).
- Sessions end after 7 days without activity; unsaved edits are kept on the device and offered back.
- Pricing: Free = 1 suggestion/month, Pro = $9.99 for 50/month (calendar month, UTC). PDF
  download free; JSON Resume export Pro only. Nobody can buy Pro yet (Week 10).
- One CV per user, public by default ("Public" is a saved flag until recruiter search, Release 2).
  "Upload new CV" replaces the CV after a warning; "new version" is a later release.
- Uploaded files are deleted once parsing finishes. Cloud storage (S3) comes with hosting (Week 12).
- PDF and DOCX only (no PowerPoint).
- Parsing is faithful to the candidate's wording; model `claude-sonnet-5-5` (`CLAUDE_MODEL`).
- Writing rules apply to Suggestions only. Master copy `.claude/skills/cv-house-style/SKILL.md`;
  backend copy `backend/app/prompts/cv_house_style.md` (a test keeps them equal).
- 💡 on Headline (from current roles + summary), Summary, each job and project description. Small
  edits = "no change" (not counted); objective-style summaries are rewritten from the CV's facts.
- Canvas: five fixed groups; entries can be moved up/down; preview and PDF use one Classic
  template (`CvTemplate.{tsx,css}`, printed via `frontend/print.html`).
- Pilot (decided 2026-10-15): up to 25 testers in India, invited emails only (`INVITE_ONLY`,
  `python -m app.cli invites add …`), one rented server running `deploy/docker-compose.prod.yml`
  (Hetzner Singapore chosen, but nothing is provider-specific: the host may change). Email:
  Resend free plan over SMTP. The user is buying a domain. Guide: `docs/DEPLOY.md`.
- Drop-off metrics in our own `events` table (`docs/FUNNEL.md`), never CV content.

## Current state
- Backend: pytest 151/151, flake8 clean; migrations up to 0008 tested up/down (SQLite + Postgres).
- Frontend: type-check clean, vitest 90/90, build OK. CI (GitHub Actions) green on every push.
- Open branches / PRs: `claude/clever-meitner-049zyv` (fully merged); no PRs.
  `claude/trusting-darwin-wwr74d` is old and fully merged (can be deleted).
- Production setup rehearsed without Docker (none in the cloud container): production build
  behind Caddy, API in production mode, invite-only refusal, login code over SMTP, PDF through
  `/api` + `print.html`, real client IP via Caddy, backup restore tested. The Docker production
  stack runs for the first time on the real server.
- Privacy notice: a DRAFT at `/privacy` (linked from the start page and Settings) and in
  `docs/PRIVACY_DRAFT.md`; placeholders listed there; a test keeps both copies equal.

## Done this session
- Week 9 and the Weeks 1–9 gap fixes (code login, sessions, upload from canvas, delete,
  rate limits, move up/down, 💡 Headline, CI) — merged (e5be3c3).
- Pilot: invite-only mode (06b95eb), production setup `deploy/` + `docs/DEPLOY.md` (28f97a3),
  privacy notice draft — merged.

## Next steps
1. User: keep testing in Docker (`git checkout main`, `git pull`, `docker compose up -d --build`
   once for this update; migrations 0005–0007 run on start). Log in with the code from
   `docker compose logs backend --tail 20`. Fix the findings they report.
2. Pilot go-live with the user, following `docs/DEPLOY.md`: they choose and buy the domain,
   create the server (Hetzner Singapore planned; host may change), Resend and (optionally) the
   Google OAuth origin; then run `deploy/setup.sh` together and invite testers.
   Before real testers: the user fills the privacy placeholders and reviews the text.
3. Week 10: billing (Stripe checkout and webhooks, Pro upgrade, receipts, admin dashboard).
4. Open: the user's scanned-CV check; parsing puts employer-wide bullets under the latest title.
5. Known limits: two open tabs = last write wins.

## Open questions for the user
- Which domain name?
- Privacy notice: operator name, contact email, applicable law (placeholders in the draft).

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests fake Postgres, Redis and Claude, so they can't catch real-API errors: check AI changes
  with a small script against the real API before merging.
- Frontend: `cd frontend && npm install`.
- Worker: Redis + `celery -A app.workers.celery_app worker` (see backend/README.md).
- PDF: needs Playwright's Chromium (`playwright install chromium`, or `PDF_CHROMIUM_PATH`, in
  the cloud container `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) and the frontend
  running at `PDF_TEMPLATE_URL` (default `FRONTEND_URL`).
- API key: **`CVSMITH_CLAUDE_KEY`** in the Claude Code cloud environment (`ANTHROPIC_*` is
  reserved there); `ANTHROPIC_API_KEY` in a root `.env` for Docker. Never commit it.
- Login codes: with no email provider set, they appear in the backend log
  (`docker compose logs backend --tail 20`). Providers: `EMAIL_PROVIDER` = log | sendgrid | smtp
  (see backend/README.md). To make a test account Pro:
  `docker compose exec postgres psql -U cvsmith_user -d cvsmith_db -c "update users set plan='pro' where lower(email)=lower('...')"`.
- Docker (`docker-compose.yml`) works on the user's Windows machine. If `.env` is not read
  again: re-save it as UTF-8 without BOM, one line, no spaces or quotes. After code changes:
  `docker compose restart` (the worker does not reload code); after Dockerfile or requirements
  changes: `docker compose up -d --build`.
- Cloud container (no Docker): Postgres 16 in `/tmp/cvsmith-pg/data`, port 5433, started with
  `pg_ctl` as the `postgres` user (remove stale `.s.PGSQL.5433*` files first);
  `redis-server --daemonize yes`; then `alembic upgrade head`, uvicorn (no `--reload`: restart it
  after backend changes), the worker, `npx vite`.
- Test CVs are real people's CVs in the user's Drive folder "CVSmith": never commit them or
  their contents. Read them with the Drive connector (`read_file_content`).
- `cv-house-style` also lives in the user's claude.ai account. After a rule change: copy the
  body to `backend/app/prompts/cv_house_style.md`, zip the skill folder, send it to the user
  and remind them to re-upload it.
