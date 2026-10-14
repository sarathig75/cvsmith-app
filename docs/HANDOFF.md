# CVSmith handoff

Updated: 2026-10-14 · main at 800258d. Session branch `claude/clever-meitner-049zyv` holds the
sticky title bar (26da23b) and Week 7–8 Suggestions; **not merged yet** (waiting for the user's OK).

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
- Suggestions checked against the real Claude API on 8 fields from the test CVs (Sonnet and
  Opus): facts, numbers and clients kept. Sonnet ~$0.013 per suggestion, 3–14 s.
- End to end in the running app (Postgres, API, Vite, real Claude API, browser): 💡 → modal →
  Use suggestion → auto-saved → second 💡 → upgrade prompt → /pricing; events recorded once.
- Fixed during testing: React StrictMode sent two AI requests per click; cut-off AI output gave
  a server error (now "try again", and only that part fails when parsing).

## Next steps
1. User: test Suggestions locally (`git pull` on the session branch or after merge, then
   `docker compose restart`; migration 0004 runs on start). Then approve the merge to main.
2. Week 9: PDF download (must reproduce the Classic template), export, privacy toggle saved
   (PATCH /api/cv/privacy).
3. Open observations from the Sonnet run (for the user to decide, not built):
   - An objective-style summary ("Secure a responsible career opportunity…") came back as
     "no change needed" from both models, since the rules forbid adding facts.
   - A nearly fine field can come back with tiny edits and still count as a suggestion.
4. The user uploads "scanned CV sample.pdf" in their running app to check a real scan.
5. Parsing quality (open): bullets covering a whole employer land under its latest title.
6. Known limits: two open tabs = last write wins; no "upload a new CV" button for logged-in
   users yet; two simultaneous 💡 clicks could both pass the quota check (accepted for R1).

## Open questions for the user
- Merge the session branch (sticky bar + Suggestions) to main?

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
- Product-management plugin connectors fail here (proxy 403); not needed so far.
