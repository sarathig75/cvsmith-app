# CVSmith handoff

Updated: 2026-10-29 · Last commit on main: a01af1a docs: ATS framework written into the repo.
This session's work is on `claude/youthful-darwin-uv0663` (pushed, not merged, no PR). Pilot not deployed.

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
- ATS score: CVSmith's own checklist (`docs/ATS_FRAMEWORK.md`), never called "compliance". Job alignment
  (Pro, shares the 50/month suggestion quota): result = Mode B score + headline + gaps + ideas; the user can
  update the base CV with ticked changes or download a job-only PDF (not kept, no JSON). Job spec text is
  never stored. Tab "Align to job" shows only on `/align*`. Contract: "Job alignment".
- Drop-off metrics in our own `events` table (`docs/FUNNEL.md`), never CV content.

## Current state
- Backend: pytest 272/272, flake8 clean (run 2026-10-29); migrations up to 0011.
- Frontend: type-check clean, vitest 158/158, build OK (run 2026-10-29).
- Open branches / PRs: `claude/youthful-darwin-uv0663` (pushed, not merged; no PR): ATS Mode A, dashboard,
  `/next`, Canvas before/after score, job alignment, privacy text. For the user to test locally
  (`docs/LOCAL_SETUP.md` 3.2).
- Real Chromium check in the cloud container: the Classic PDF gives layout facts `text ok, 3 headings,
  0 tables, 1 page`; not yet seen by the user in the browser.
- User's local `docker compose up -d --build` of this branch was in progress: the backend `pip install` and
  Chromium downloads ran at about 100 kB/s (slow network, not a bug); result not yet reported.
- User's new Windows PC runs the full Docker stack (`docs/LOCAL_SETUP.md`): email-code login,
  upload + parsing and Google sign-in confirmed working. Rest of checklist 3.2 not yet reported.
- Google sign-in: OAuth client (Web application) in Google Cloud, consent screen in **Testing**; origin
  `http://localhost:5173` added; the production domain is not yet.
- Privacy notice: DRAFT at `/privacy` and `docs/PRIVACY_DRAFT.md`; text now covers scores, the
  unmatched-term store and edit counts. Placeholders (operator, contact email, law, links, hosting) still open.

## Done this session
- 2026-10-29: **ATS Mode A** (`backend/app/services/ats/`: lists, facts, layout, text, score, service).
  Checks A1-A11 from `docs/ATS_FRAMEWORK.md`; "before" score saved when the upload is parsed, "after" from
  the PDF made from the saved CV (cached by content hash). Mode B scoring rules are in the code and
  tested, but unused. How each check is measured: contract, "ATS format score".
- 2026-10-29: `GET /api/dashboard`, `GET /api/ats`, `POST /api/next/viewed`; CV strength per the proposal
  in the contract; migration 0010 (`cvs.ats_before`, `cvs.ats_layout_after`).
- 2026-10-29: frontend `/dashboard`, `/next`, Canvas ATS card; logged-in users go to the dashboard (to the
  Canvas right after sign-up/login with a CV chosen); every download lands on `/next`; Dashboard in header.
- 2026-10-29: CLI `users set-plan <email> free|pro`; privacy text updated.
- 2026-10-29: **Job alignment** (contract "Job alignment"; mocks approved in the design file, boards "Align to
  job"). Pro only, shares the 50/month suggestion quota, migration 0011 (`alignment_runs`, no job spec text).
  `POST /api/alignment` (2 AI steps: spec to requirements, then headline + ideas), `GET /{id}`, `/preview`
  (live Mode B score as items are ticked, no AI), `/apply` (updates the saved CV, then the Canvas opens),
  `/download` (job-only PDF, nothing stored, no JSON). Frontend: small dashboard card, `/align`, `/align/:id`,
  "Align to job" tab only on those screens, card 1 on `/next`. Checked end to end in the cloud container with
  the real Claude API and Chromium (screens and a job PDF); not yet by the user.
- 2026-10-31: Canvas ATS card lists every check and re-scores after each save; **Improve all** (Pro): confirm
  with the count, one suggestion per field in order (jobs, projects, summary, headline), applies changed ones
  without `missing_details`, "Undo all"; dashboard "Upload a new CV" button; Pro quota message fixed.
  Finding: some checks (bullets of 15-30 words, strong verbs, one date format) cannot be raised by 💡
  suggestions, because the house style calls those fields "already in good shape".
- 2026-10-29: **Decisions made without asking** (reverse if wrong): a job PDF download stays on the result page
  (no `/next`); `/align` and its API need a saved CV (`content`), else "Open your CV on the Canvas first";
  a proposed headline naming something not in the CV is dropped (same guard as suggestions, which only checks
  capitalised words); Dismiss is on screen only and lasts until the page is left.
- Earlier: suggestion guard `9cdd6c9`, summary name note `a6b2a40`, prompt caching `a8e02d1`, evaluation set, learning store.

## Resume on the laptop (user travelling Pune to Chennai, 2026-10-29)
- `git fetch origin && git checkout claude/youthful-darwin-uv0663 && git pull`, then `docs/LOCAL_SETUP.md` 3.2.
- Pune PC build result: `pip install` now passes (cached); `playwright install --with-deps chromium` was
  killed (exit 137, "cannot allocate memory"): Docker/WSL ran out of RAM. Fix on that PC: `.wslconfig`
  with `[wsl2] memory=6GB swap=6GB` (less if the PC has 8 GB), `wsl --shutdown`, restart Docker Desktop,
  `docker compose build backend`. The apt download (99.5 MB) restarts on each retry; an apt cache mount in
  `backend/Dockerfile` would help on the slow link (offered, not done). Check the laptop's RAM first.
- On the Pune PC the old uncommitted copies of the summary-note work were stashed (`git stash list`; safe to
  drop); `CV/` (real CVs) is git-ignored; the Docker build there was still running when the user left.

## Next steps
0. User tests the branch locally (checklist 3.2, incl. job alignment), then merge to `main`.
1. Phone layouts of the dashboard, `/next` and the Align to job screens (no mocks wanted; check at phone width).
2. Evaluation: re-run `python -m evals.run_suggestions --repeats 2` after any prompt change; consider a small
   evaluation for the alignment headline (does it invent anything?).
3. Fill the privacy placeholders; domain; pilot go-live per `docs/DEPLOY.md`; Week 10 billing.

## Open questions for the user
- Decided 2026-10-29: accepting a suggestion is never blocked; a missing-detail note is only a suggestion.
- Summary growth for positioning statements: keep the 1.5× limit as it is?
- Improve all applies suggestions that mention names not in the CV? Chosen: no (listed for review). OK?
- A free user can open `/align` but is told to upgrade on submit: should Free see a sample result instead?
- Related job families for B5 (3 points): only HR/Operations and Data/Finance are listed; add more pairs?
- Which domain name? Privacy notice: operator name, contact email, applicable law (still open).

## Setup notes
- Slow first Docker build (pip + Chromium downloads): let it finish; build `backend` before `celery`
  (`docker compose build backend`) so they do not share the bandwidth; later builds use the cache.
  `backend/Dockerfile` now has longer pip timeouts/retries and a pip cache mount (added after a pip exit 2 on
  the slow link; not tested here, no Docker daemon in the cloud container).
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
