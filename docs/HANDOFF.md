# CVSmith handoff

Updated: 2026-10-28 · Last commit on main: a8e02d1 Prompt caching; objective summaries replaced from CV facts (rule 14).
Includes the suggestion guard for names not in the CV (committed 2026-10-29, to test).
Everything else is merged. Pilot not deployed.

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
- 2026-10-28 (committed 2026-10-29, to test): suggestion guard. A suggestion that names a skill, employer or person
  not in the CV is not rejected. The create response carries `missing_details`, the modal asks the user to
  add the detail first, and accepting is still allowed. Contract: `docs/API_CONTRACT.md` ("Suggestion
  guard"). Rule lives in `backend/app/services/suggestion_guard.py`; the evaluation runner uses it too.
  Backend 195 tests, frontend 97 tests, build OK.
- 2026-10-28: prompt caching on suggestions and the CV parser (a8e02d1, committed).
- 2026-10-28: house-style rules 12–14 (weak phrasing, decorative summaries, objectives replaced from CV
  facts). Evaluation: prompt version 3 passes 4 of 5 checks in 2 runs (contract has the numbers).
- 2026-10-28: ATS framework agreed (two modes, 100 points each); fixed lists approved, incl.
  automotive, pharma, FMCG (`docs/ATS_RULES.md`). Unmatched items: not scored, not shown, stored
  with text for review at ≥5 sightings.
- 2026-10-28: learning store and counts built (contract: `docs/API_CONTRACT.md`, "Suggestion
  effectiveness"): migration 0009, `unmatched_terms` table, `suggestions.edited_at`, edit endpoint,
  CLI `suggestions report` and `unmatched report|ignore|resolve`. Frontend counts the first edit of
  an accepted suggestion (no text). Backend 185 tests, frontend 96 tests.
- 2026-10-28: evaluation set built: 25 invented cases (`backend/evals/cases.json`), checks, runner
  `python -m evals.run_suggestions --repeats 2`. Baseline is in the contract. Results are local
  (git-ignored).

## Next steps
0. TEST (user): suggestion guard (committed 2026-10-29).
   a. Open a CV, click 💡 on the summary, and check a suggestion that names an employer not in the CV: a
      note appears; "Use suggestion" still works; the suggestion counts toward quota.
   b. A suggestion with only names already in the CV: no note.
   c. Summary 💡 with an objective ("Seeking a role…"): replaced by a statement from the CV.
   d. Upload, edit and download still work (PDF, JSON).
   Decide: should accepting be blocked until the detail is added to the CV? (Contract assumes no.)
1. Evaluation: re-run `python -m evals.run_suggestions --repeats 2` after any prompt change. Open:
   summary growth for positioning statements (1 of 2 in the last run, sales case).
2. ATS score (contract ATS section; lists in `docs/ATS_RULES.md`): Mode A on the dashboard, Mode B in job
   alignment; the unmatched store starts receiving terms here.
3. Dashboard `/dashboard`, `/next`, job alignment, Canvas before/after (approved layouts:
   `https://claude.ai/artifact/4CzxsdYGX3LX2KAUooUS8K`; `docs/USER_JOURNEYS.md`).
4. Privacy notice must cover the unmatched-term store and suggestion counts before pilot users join.
   Domain and operator details are still open.
5. Pilot go-live per `docs/DEPLOY.md`; Week 10 billing.

## Open questions for the user
- Test the suggestion guard and report any problems.
- Should accepting a suggestion with missing details be blocked until the detail is added to the CV?
- Summary growth for positioning statements: keep the 1.5× limit as it is?
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
