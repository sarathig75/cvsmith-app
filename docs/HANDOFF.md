# CVSmith handoff

Updated: 2026-10-13 · Last commit on main before this note: 356df9a fix(docker): run database migrations when the
backend container starts

## Product decisions (stable)
- Google sign-in only for social login (no Apple in Release 1).
- Pricing: Free = 1 suggestion/month, Pro = $9.99 for 50/month.
- New CVs are public by default; one CV per user (a new upload replaces the old one).
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- Branching: `main` plus short-lived `feature/*` branches.
- Google sign-in links to an existing same-email account; an unverified account's password is removed.
- CV parsing model: `claude-sonnet-5-5` (kept after a 5-CV Sonnet vs Opus comparison: no clear
  quality winner, Sonnet ~2x cheaper and faster). Changeable via `CLAUDE_MODEL`.
- Parsing is faithful: it keeps the candidate's wording. Writing rules (active verbs, no "I",
  etc.) apply to Suggestions only. Master copy: `.claude/skills/cv-house-style/SKILL.md`
  (reviewed by the user). Suggestions show Current → Suggested only: no rule explanations, no
  questions; never add or ask for numbers; expand an abbreviation only if its meaning is known.
- Parsing UX: upload never waits; canvas editable immediately; parsed data fills only empty fields.
  Exception: the CV's email replaces the pre-filled account email.
- Dates: Month + Year dropdowns with "Years only"; stored "YYYY-MM" or "YYYY".
- Work entries have "I currently work here"; parser sets `current` only when the CV says so.
- Canvas = five fixed groups: Personal details, Professional details (summary, work, projects),
  Education, Skills & Certifications (skills are LinkedIn-style tags), Others (languages, awards,
  volunteering, interests, user-named custom sections). New content types go into Others
  (`frontend/src/utils/otherKinds.ts`), not new sections. Preview follows the same order.
- PowerPoint uploads are not accepted (PDF and DOCX only).
- Drop-off metrics: our own `events` table (option A), steps listed in the plan; no CV content.
- Saving: parser writes `json_resume`, auto-save writes `content` (+ `applied_parts`); a new upload
  replaces the CV and edits only after the user confirms (option a). Auto-save ~2 s after typing.
- Release 2: current-employer shield for recruiter search (see plan doc).

## Current state
- Backend: pytest 84/84 passing, flake8 clean; migrations 0002 and 0003 tested up/down on SQLite and Postgres 16.
- Frontend: type-check clean, vitest 54/54 passing, `vite build` OK.
- Parser verified against the real Claude API on 5 real CVs (Word, two-column PDF, fresher,
  one-pager): all parse. Three parallel requests per CV, each part saved as it finishes
  (`parsing_parts`). First data after 1.9–5.0 s (was 3.0–22.1 s), all done after 5–19 s.
  Cost ~$0.04–0.08 per CV (estimated, not measured).
- End-to-end in the running app (Postgres 16 + Redis + API + Celery worker + Vite, real Claude
  API, sign-up and upload through the browser) works: a text PDF of a real CV filled contact
  details and skills by 5.0 s and work/education by 10.8 s; an image-only (scan-like) PDF went
  to Claude as a document and parsed fully and correctly in 4.9 s. Migration 0002 ran on Postgres.
- The user's own scanned CV ("scanned CV sample.pdf" in Drive) could not be pushed through the
  app from a cloud session: the Drive connector returns files inline, not as files on disk.
  The scan path was tested with a synthetic image-only PDF instead.
- Week 5–6 is complete and merged: saving, restore on load, confirm-before-replace, funnel
  tracking. Migrations run automatically on `docker compose up` (backend start command).
- Open branches / PRs: none besides the session branch, which is merged into main.

## Done this session (details in `git log`)
- Real parsing fixed (bcd1b1b); Sonnet kept after a 5-CV comparison with Opus.
- Parser: languages, awards, volunteer, projects, interests; progressive parsing in three parts
  (118c72b); no duplicate awards (f287c58). Verified end to end, incl. a scan-like PDF.
- Canvas: five groups, Others with typed items, skills as tags (92ae610, b2f19c0).
- Week 5–6: saving, restore on load, confirm-before-replace, funnel events and `docs/FUNNEL.md`
  (e10ac4c, 6705662, 407c4c7). Verified end to end in the running app.
- `cv-house-style` skill written with the user and uploaded to their claude.ai account (fd6ced6).

## Next steps
0. **In progress: the user is setting up local testing on Windows.** Done so far: Git installed,
   repo cloned to `$HOME\Documents\cvsmith-app` (PowerShell), `.env` with `ANTHROPIC_API_KEY`
   presumably created (confirm it is `.env`, not `.env.txt`), Docker Desktop installed for
   "All users" and the machine is restarting. To resume: open Docker Desktop and wait for
   "Engine running" (if WSL errors: `wsl --update` in an admin PowerShell); in a new PowerShell
   run `docker --version`, then `git pull` (gets 356df9a, migrations on start) and
   `docker compose up --build`; open http://localhost:5173. Checklist to walk through with the
   user: upload + groups filling in; their real "scanned CV sample.pdf"; edit → "Saving…" /
   "All changes saved"; reload restores; deleted entry stays deleted; log out, pick a new file,
   log in → replace prompt (try Keep and Replace); Others/custom section and "Python, SQL" tags;
   sign up without a file and save. Not bugs: Google sign-in (no local credentials), emails only
   logged, Download PDF disabled, privacy not saved, no re-upload button. Never tested with
   Docker by Claude (no Docker daemon in the cloud container).
1. Week 7–8 Suggestions (next build). Prompt from `.claude/skills/cv-house-style/SKILL.md`;
   quota Free 1/month, Pro 50/month (plan doc). Before coding, confirm with the user: which
   fields get a 💡 first, what counts as "one suggestion" (per field or per bullet), and the
   upgrade prompt wording. Add funnel events suggestion_requested / upgrade_prompt_shown.
2. The user uploads "scanned CV sample.pdf" in the running app on their own machine to check a
   real scan (the only part of the end-to-end tests not done).
3. Parsing quality (open): bullets covering a whole employer land under its latest title.
   Text that belongs to no single role, incl. project lists describing work at an employer,
   stays in the summary (user decision 2026-10-13, option a).
4. Known limits of saving: two open tabs = last write wins; privacy toggle is not saved yet
   (PATCH /api/cv/privacy is Week 9); logged-in users have no "upload a new CV" button yet.

## Open questions for the user
- none

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests need no Postgres, Redis or API key (all faked) — so they cannot catch real-API errors;
  check parser changes against the real API with a small script before merging.
- Frontend: `cd frontend && npm install`.
- Parsing worker: Redis + `celery -A app.workers.celery_app worker` (see backend/README.md).
- API key: env var **`CVSMITH_CLAUDE_KEY`** in the Claude Code cloud environment
  (`ANTHROPIC_*` is reserved there); `ANTHROPIC_API_KEY` works locally/Docker. Never commit it.
- Test CVs are real people's CVs in the user's Google Drive folder "CVSmith"; never commit them
  or their contents. Read them with the Drive connector (`read_file_content` gives text;
  downloads come back inline, not as files).
- Full stack: `docker-compose.yml` (Postgres, Redis, backend, Celery worker, frontend); needs
  `ANTHROPIC_API_KEY` in a root `.env`; migrations run on backend start. The user tests on
  Windows (Git + Docker Desktop); not yet confirmed working there. The cloud
  container has no Docker daemon, but Postgres 16 and Redis are installed: run them natively
  (initdb/pg_ctl as the `postgres` user, port 5433; `redis-server --daemonize yes`), then
  `alembic upgrade head`, uvicorn, `celery -A app.workers.celery_app worker` and `npx vite`.
- `cv-house-style` exists twice: the repo copy (master) and the user's claude.ai upload, which
  Claude cannot update. After any rule change: zip the folder
  (`cd .claude/skills && zip -r cv-house-style.zip cv-house-style`), send it to the user, and
  remind them to re-upload it in claude.ai.
- The product-management plugin connectors (Amplitude, Linear, Notion, Slack, ...) failed to
  connect in this environment (proxy 403). Not needed so far; they would need network access.
