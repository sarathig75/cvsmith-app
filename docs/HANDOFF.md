# CVSmith handoff

Updated: 2026-10-14 · Last commit on main: 981c02e (this note sits on top of it)

## Product decisions (stable)
- `docs/API_CONTRACT.md` is binding: change the contract first, then the code.
- Google is the only social login (no Apple in Release 1). Same-email accounts are linked.
- Pricing: Free = 1 suggestion/month, Pro = $9.99 for 50/month (calendar month, UTC).
- One CV per user, public by default; a new upload replaces the CV after the user confirms.
- PDF and DOCX only (no PowerPoint).
- Parsing is faithful to the candidate's wording; model `claude-sonnet-5-5` (`CLAUDE_MODEL`).
  Progressive: contact part (pattern, ~1 s), then basics / experience / extras (AI, parallel).
- Writing rules apply to Suggestions only. Master copy: `.claude/skills/cv-house-style/SKILL.md`;
  the backend uses a copy in `backend/app/prompts/cv_house_style.md` (a test keeps them equal).
- Suggestions (Week 7–8, details in the plan doc): 💡 Improve on the Summary, each Work
  Experience description and each Project description; one click = one suggestion for the
  whole field; "no change needed" and failures don't count; Sonnet (`SUGGESTION_MODEL`), Opus
  compared and not chosen (~2x cost, slower, similar quality). Nobody is Pro yet (`users.plan`).
- Canvas = five fixed groups (Personal, Professional, Education, Skills & Certifications,
  Others). New content types go into Others (`frontend/src/utils/otherKinds.ts`).
- Preview: 60/40 layout, Classic template (`CvTemplate.{tsx,css}`; the Week 9 PDF must match),
  follows the section being edited, − Fit + zoom, "View full CV". Title bar with Download PDF
  and Settings stays in view (tablet and up).
- Saving: auto-save ~2 s after a change; drop-off metrics in our own `events` table
  (`docs/FUNNEL.md`), never CV content.
- Release 2: current-employer shield for recruiter search (plan doc).

## Current state
- Backend: pytest 103/103, flake8 clean; migration 0004 (users.plan, suggestions) tested
  up/down on SQLite and Postgres 16.
- Frontend: type-check clean, vitest 66/66, `vite build` OK.
- Open branches / PRs: `claude/clever-meitner-049zyv` (fully merged into main); no PRs.
- Real Claude API: suggestions on 8 fields from the test CVs kept facts, numbers and clients.
  Sonnet ~$0.013 per suggestion, 3–14 s.
- End to end in the running app (Postgres, API, Vite, real Claude API, browser): 💡 → modal →
  Use suggestion → auto-saved → second 💡 → upgrade prompt → /pricing; events recorded once.

## Done this session
- 26da23b Title bar with Download PDF and Settings stays in view while scrolling.
- 8db88f0 Suggestions backend: quota, house-style AI rewrite, decisions, migration 0004.
- 33ccefa Suggestions UI: 💡 Improve, suggestion modal, upgrade prompt, quota hint.
- 38e917e Fixes found in testing: one AI request per click (StrictMode sent two); cut-off AI
  output now gives "try again" (and fails only that part when parsing).
- 857d21c Plan doc (Week 7–8 ticked), FUNNEL.md (new events). Merged to main (981c02e).
- Sonnet vs Opus side-by-side for suggestions: Sonnet kept (~2x cheaper, faster, same quality).

## Next steps
1. User: test Suggestions locally (`git checkout main`, `git pull`, `docker compose restart`;
   migration 0004 runs on start) and report observations.
2. Week 9: PDF download (must reproduce the Classic template), export, privacy toggle saved
   (PATCH /api/cv/privacy).
3. The user uploads "scanned CV sample.pdf" in their running app to check a real scan.
4. Parsing quality (open): bullets covering a whole employer land under its latest title.
5. Known limits: two open tabs = last write wins; no "upload a new CV" button for logged-in
   users yet; two simultaneous 💡 clicks could both pass the quota check (accepted for R1).

## Open questions for the user
- Objective-style summaries ("Secure a responsible career opportunity…") come back as "no
  change needed", because the rules forbid adding facts. Options: leave as is, or let the
  suggestion turn it into a short factual summary from the rest of the CV. Decide after testing.
- Small edits to an already-good field still count as the month's suggestion. Options: leave
  as is, or tell the model to return "no change" unless the improvement is material. Decide
  after testing.

## Setup notes
- Backend: `cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
  Tests fake Postgres, Redis and Claude, so they can't catch real-API errors: check AI changes
  with a small script against the real API before merging.
- Frontend: `cd frontend && npm install`.
- Worker: Redis + `celery -A app.workers.celery_app worker` (see backend/README.md).
- API key: **`CVSMITH_CLAUDE_KEY`** in the Claude Code cloud environment (`ANTHROPIC_*` is
  reserved there); `ANTHROPIC_API_KEY` in a root `.env` for Docker. Never commit it.
- Docker (`docker-compose.yml`) works on the user's Windows machine. If `.env` is not read
  again: re-save it as UTF-8 without BOM, one line, no spaces or quotes. After code changes:
  `docker compose restart` (the worker does not reload code).
- Cloud container (no Docker): Postgres 16 in `/tmp/cvsmith-pg/data`, port 5433, started with
  `pg_ctl` as the `postgres` user (remove stale `.s.PGSQL.5433*` files first);
  `redis-server --daemonize yes`; then `alembic upgrade head`, uvicorn, the worker, `npx vite`.
- Test CVs are real people's CVs in the user's Drive folder "CVSmith": never commit them or
  their contents. Read them with the Drive connector (`read_file_content`).
- `cv-house-style` also lives in the user's claude.ai account. After a rule change: copy the
  body to `backend/app/prompts/cv_house_style.md`, zip the skill folder, send it to the user
  and remind them to re-upload it.
