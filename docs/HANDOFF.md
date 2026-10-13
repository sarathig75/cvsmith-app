# CVSmith handoff

Updated: 2026-10-13 · Last commit on main before this note: 4e1a751 docs: update handoff

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
- Release 2: current-employer shield for recruiter search (see plan doc).

## Current state
- Backend: pytest 72/72 passing, flake8 clean; migration 0002 tested up and down on SQLite.
- Frontend: type-check clean, vitest 47/47 passing, `vite build` OK.
  (All checks run at 118c72b; later commits change only docs.)
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
- Open branches / PRs: none besides the session branch, which is merged into main.

## Done this session
- Key verified; fixed real parsing (every call failed with 400 "compiled grammar is too large",
  bcd1b1b); Sonnet vs Opus on 5 CVs, kept Sonnet.
- Writing rules for suggestions + ATS-readable PDF template item in the plan (67edf90).
- Parsing in two parallel requests; new sections languages, awards, volunteer, projects,
  interests; rules against repeated roles, invented jobs and dropped content (f830b90).
- Canvas regrouped into five groups, Others with typed items, headline, education score,
  skills as tags (92ae610, b2f19c0); plan doc records the layout and re-order suggestions (8f4b182).
- `cv-house-style` skill drafted and revised with the user (f6a6183, 7cbe7f2, fd6ced6); the user
  uploaded it to their claude.ai account.
- Progressive parsing: contract, migration 0002, parser, worker and canvas (118c72b), merged.
- Funnel tracking planned for Week 5–6 in the plan doc (eaed67f).
- End-to-end test of progressive parsing in the running app (text PDF and scan-like PDF).

## Next steps
1. The user uploads "scanned CV sample.pdf" in the running app on their own machine to check a
   real scan (the only part of the end-to-end test not done).
2. Parsing quality (open): bullets covering a whole employer land under its latest title; an
   achievement listed under a job (e.g. "Employee of the month") can also appear in Awards, as
   the two parts extract it independently. Text that belongs to no single role stays in the
   summary (user decision 2026-10-13, option a).
3. Week 5–6: save canvas edits to the backend (PATCH /api/cv), session restore, and funnel
   tracking (own events table, plan doc "Funnel tracking"; never record CV content).
4. Week 7–8 Suggestions: build its prompt from `.claude/skills/cv-house-style/SKILL.md`.

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
- Full stack: `docker-compose.yml` (Postgres, Redis, backend, Celery worker, frontend). The cloud
  container has no Docker daemon, but Postgres 16 and Redis are installed: run them natively
  (initdb/pg_ctl as the `postgres` user, port 5433; `redis-server --daemonize yes`), then
  `alembic upgrade head`, uvicorn, `celery -A app.workers.celery_app worker` and `npx vite`.
- `cv-house-style` exists twice: the repo copy (master) and the user's claude.ai upload, which
  Claude cannot update. After any rule change: zip the folder
  (`cd .claude/skills && zip -r cv-house-style.zip cv-house-style`), send it to the user, and
  remind them to re-upload it in claude.ai.
- The product-management plugin connectors (Amplitude, Linear, Notion, Slack, ...) failed to
  connect in this environment (proxy 403). Not needed so far; they would need network access.
