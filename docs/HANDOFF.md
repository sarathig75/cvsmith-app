# CVSmith handoff

Updated: 2026-10-31 · `main` has PR #1 (ATS score, dashboard, job alignment, Improve all, score panel) and PR #2 (A6 wording,
wider verb list, handoff). CI green on both heads. Open branches: none. Pilot not deployed.

## Product decisions (stable)
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- **Login = one-time 6-digit email code** + Google sign-in; no passwords in Release 1 (code kept,
  off via `PASSWORD_LOGIN_ENABLED`). SMS/phone login rejected (cost, DLT, abuse).
- Email: Resend free plan (3,000/month, 100/day) over SMTP; `EMAIL_PROVIDER` = log|sendgrid|smtp.
- Sessions end after 7 days without activity; unsaved edits are kept and offered back.
- Pricing: Free 1 suggestion/month, Pro $9.99 for 50/month (calendar month, UTC). PDF free; JSON
  export Pro only. Pro can't be bought yet (Week 10); test with `python -m app.cli users set-plan <email> pro`.
- One CV per user, public by default (a flag until recruiter search, Release 2). "Upload new CV"
  replaces it after a warning. PDF/DOCX only; the uploaded file is deleted once parsed.
- Parsing keeps the candidate's wording (`claude-sonnet-5-5`). Writing rules apply to 💡 only:
  master `.claude/skills/cv-house-style/SKILL.md`, copy in `backend/app/prompts/` (test-synced). Rules 15-16
  (strong first verb from the ATS list; 15-30 word bullets, facts only) added 2026-10-31.
- 💡 on Headline, Summary, job and project descriptions; small edits = "no change" (not counted). An existing
  summary is only reworded; an empty one is written from the CV's facts.
- Canvas: five groups, entries move up/down; one Classic template for preview and PDF, work section headed
  "Professional experience".
- Pilot: ≤25 testers in India, invited emails only (`INVITE_ONLY`; `python -m app.cli invites add …`), one
  server running `deploy/docker-compose.prod.yml`. Guide: `docs/DEPLOY.md`.
- Start page claims only what works today; no recruiter search.
- **ATS score** (`docs/ATS_FRAMEWORK.md`, `ats-framework-v2`): CVSmith's own checklist, never called
  "compliance". Mode A (A1-A12) on the dashboard and Canvas; Mode B (job match) in job alignment. Panel: ring +
  group bars (Searchability, Writing; Hard skills, Job fit), issues collapsed, fix buttons by `fix_kind`,
  "Fix all" (automatic fixes: dates as year only, with Undo). Nothing is invented: phone, location, numbers,
  job titles are the user's to give.
- **Job alignment** (Pro, shares the 50/month quota; contract "Job alignment"): Mode B score before/after ticked
  changes (live), proposed headline and summary, gaps, ideas; update the base CV (opens the Canvas) or download a
  job-only PDF (not kept, no JSON). Job spec text is never stored. "Align to job" tab only on `/align*`.
- **Improve all** (Pro, in the score panel): confirm with the count, one suggestion per field (jobs, projects,
  summary, headline), applies changed ones without `missing_details`, "Undo all". Free keeps single 💡.
- Drop-off metrics in our own `events` table (`docs/FUNNEL.md`), never CV content.

## Current state
- Backend: pytest 294/294, flake8 clean; migrations up to 0011. Frontend: type-check clean, vitest 178/178,
  build OK. CI (backend, frontend) green on the PR head (2026-10-31).
- Checked end to end in the cloud container with the real Claude API and Chromium (dashboard, job alignment,
  job PDF, Improve all, score panel). The user has checked on Windows/Docker: login, Google sign-in, parsing,
  dashboard, job alignment. **Not yet checked by the user:** the score panel with "Fix all", Improve all, the
  summary in job alignment, "Professional experience" heading.
- Google sign-in: OAuth client (Web application), consent screen in **Testing**; origin
  `http://localhost:5173` only; the production domain is not added.
- Privacy notice: DRAFT at `/privacy` and `docs/PRIVACY_DRAFT.md` (covers scores, unmatched terms, edit counts,
  job descriptions). Placeholders (operator, contact email, law, links, hosting) still open.

## Done this session (2026-10-29 to 10-31, all in PR #1)
- ATS Mode A/B scoring (`backend/app/services/ats/`), "before" score kept at parse, "after" from the generated PDF;
  `GET /api/dashboard`, `/api/ats`; CV strength; `/dashboard`, `/next`; Canvas score panel; migration 0010.
- Job alignment (migration 0011, `/api/alignment*`, `/align`, `/align/:id`), summary proposal, live preview.
- Framework v2: A12 (job title and employer on every role), header-only contact penalty (A4), point re-split
  (Claude's proposal), heading "Professional experience"; contact in Word headers found at parse time.
- House style rules 15-16 + prompt tweak (evaluation 25/25, 1 run); Pro "all 50 used" message; dashboard "Upload
  a new CV"; backend Dockerfile pip retries/cache; `/CV/` git-ignored; privacy text.
- Decisions made without asking (reverse if wrong): a job PDF download stays on the result page (not `/next`);
  `/align` needs a saved CV (`content`); a proposed headline/summary naming something not in the CV is dropped;
  Dismiss is on screen only; "Fix all" only does the date format.

- 2026-10-31 (PR #2): A6 now names the first words that count
  against the user; the verb list was widened from 52 to 85 (user chose "widen"; list in `docs/ATS_RULES.md` section
  1, also in house-style rule 15, so the zip must be re-uploaded again); a weak opener (Supported, Helped...) is the
  user's to reword (`fix_kind` `go_experience`), not an Improve all job. Evaluation 1 run: 24/25 on
  `summary_not_longer` (known borderline, see open questions), the rest 25/25.

## Next steps
1. User tests on the laptop (`docs/LOCAL_SETUP.md` 3.2): `git checkout main && git pull`, `docker compose up -d
   --build` (see Setup notes if the build is slow or runs out of memory), then the score panel, Fix all, Improve
   all, job alignment with the summary.
2. Re-upload `cv-house-style.zip` (rules 15-16) to the user's claude.ai account (the backend copy is current).
3. Review the widened verb list with the user if they want to change it (`docs/ATS_RULES.md` section 1).
4. Phone layouts of dashboard, `/next`, Align to job and the score panel (no mocks wanted; check at phone width).
5. Evaluation: re-run `python -m evals.run_suggestions --repeats 2` after any prompt change; consider one for the
   alignment headline/summary (does it invent anything?).
6. Fill the privacy placeholders; domain; pilot go-live per `docs/DEPLOY.md`; Week 10 billing.

## Open questions for the user
- Summary growth for positioning statements: keep the 1.5× limit? (Alignment summaries may grow to 500 characters.)
- Improve all skips suggestions that mention names not in the CV (listed for review). OK?
- A free user can open `/align` but is told to upgrade on submit: show a sample result instead?
- Related job families for B5 (3 points): only HR/Operations and Data/Finance are listed; add pairs?
- "Fix all" only fixes the date format; any other automatic fix wanted?
- Which domain name? Privacy notice: operator name, contact email, applicable law.

## Setup notes
- Slow first Docker build (pip + Chromium downloads, about 100 kB/s on the Pune link): let it finish; build
  `backend` before `celery` (`docker compose build backend`). `playwright install --with-deps chromium` was killed
  (exit 137, out of memory) in Docker/WSL: set `[wsl2] memory=6GB swap=6GB` in `%USERPROFILE%\.wslconfig` (less
  on an 8 GB PC), `wsl --shutdown`, restart Docker Desktop. An apt cache mount in `backend/Dockerfile` would
  help (offered, not done; the pip cache mount and retries are in, untested: no Docker daemon in the cloud).
- A new PC needs a root `.env` (git-ignored) with `ANTHROPIC_API_KEY` and `GOOGLE_OAUTH_CLIENT_ID` (client ID,
  not the `GOCSPX-` secret); write it with `-Encoding ascii`; after any `.env` change run `docker compose up -d`
  (restart does not re-read it). A missing key shows "The CV parsing service is not available right now";
  a wrong Google ID shows `invalid_client`. Login codes: `docker compose logs backend`.
- The frontend container mounts `./frontend`, so it shows whatever branch is checked out; the backend needs
  `docker compose restart` (or `up -d --build`) after a pull. On Windows, run `docker compose restart` after a pull.
- Local problems: use the `local-troubleshoot` skill (symptom table + diagnostic file, `docs/LOCAL_SETUP.md` 5.1).
- Backend in the cloud container: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r
  requirements.txt`. Tests fake Postgres, Redis, email, Chromium and Claude: check AI changes against the real API
  (`CVSMITH_CLAUDE_KEY` is set there). Never commit or print keys. Frontend: `cd frontend && npm install`.
- PDF needs Chromium (`PDF_CHROMIUM_PATH`; cloud: `/opt/pw-browsers/chromium`) and the frontend at
  `PDF_TEMPLATE_URL`. Cloud full stack (no Docker): sqlite is enough (`DATABASE_URL=sqlite:////tmp/x.db`),
  `alembic upgrade head`, uvicorn, `npx vite`; no worker needed unless uploading.
- Test CVs are real people's CVs (Drive folder "CVSmith", local `CV/`, git-ignored): never commit them.
- The design file with all approved mocks: https://claude.ai/artifact/4CzxsdYGX3LX2KAUooUS8K
