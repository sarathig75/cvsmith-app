# CVSmith handoff

Updated: 2026-10-14 · Last commit on main: c74df6e docs: update handoff. Week 9 is on the session
branch `claude/clever-meitner-049zyv`, not merged yet (waiting for the user's OK).

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
- Week 9: PDF made by headless Chromium from the frontend's `print.html` (the same Classic
  template as the preview); PDF download free for all, JSON Resume export Pro only; "Public" is
  a saved flag only until recruiter search (Release 2). Suggestions: small edits = "no change";
  objective-style summaries are rewritten from the CV's own facts.
- Canvas = five fixed groups (Personal, Professional, Education, Skills & Certifications,
  Others). New content types go into Others (`frontend/src/utils/otherKinds.ts`).
- Preview: 60/40 layout, Classic template (`CvTemplate.{tsx,css}`; the Week 9 PDF must match),
  follows the section being edited, − Fit + zoom, "View full CV". Title bar with Download PDF
  and Settings stays in view (tablet and up).
- Saving: auto-save ~2 s after a change; drop-off metrics in our own `events` table
  (`docs/FUNNEL.md`), never CV content.
- Release 2: current-employer shield for recruiter search (plan doc).

## Current state
- Backend: pytest 114/114, flake8 clean. Frontend: type-check clean, vitest 71/71, build OK.
- Open branches / PRs: `claude/clever-meitner-049zyv` = main + Week 9 (unmerged); no PRs.
  `claude/trusting-darwin-wwr74d` is old and fully merged (the user may delete it).
- Week 9 checked end to end in the running app (Postgres, API, Vite, browser): an unsaved edit
  is saved, then the PDF downloads in ~1.6 s as "<Name> CV.pdf" (A4, real selectable text, one
  column); free Export JSON → upgrade prompt; Pro export has `meta.cvsmith.privacy`; Private
  survives a reload; events recorded once.
- New suggestion rules checked on the real API with test-CV fields: objective summary rewritten
  from CV facts (2/2), near-fine job description returned "no change" (2/2).
- **Not tested: Docker.** The backend image now installs Chromium (`playwright install
  --with-deps chromium`, ~+300 MB) and compose sets `PDF_TEMPLATE_URL=http://frontend:5173`.

## Done this session
- Suggestions: materiality rule and objective-summary rewrite (server adds CV facts for summaries).
- PATCH /api/cv/privacy, GET /api/cv/download (PDF), GET /api/cv/export (JSON Resume, Pro).
- Frontend: Download PDF (saves pending edits first), Export JSON, privacy saved on click,
  shared Upgrade modal, `print.html` + `print.css` (A4 pages, entries not split across pages).
- Contract, FUNNEL.md (pdf_downloaded, json_exported) and plan doc (Week 9 ticked) updated.

## Next steps
1. User: approve the merge of Week 9, then test it with Docker. It needs a rebuild, not just a
   restart: `git pull`, then `docker compose up -d --build` (first build downloads Chromium).
2. Next build (user to choose): Week 10 billing (Stripe, Pro upgrade, receipts, admin
   dashboard) or the Weeks 1–4 gaps (password reset, real email sending, S3, CI).
3. The user uploads "scanned CV sample.pdf" in their running app to check a real scan.
4. Parsing quality (open): bullets covering a whole employer land under its latest title.
5. Known limits: two open tabs = last write wins; no "upload a new CV" button for logged-in
   users yet; two simultaneous 💡 clicks could both pass the quota check (accepted for R1).

## Open questions for the user
- Merge Week 9 to main?
- After Week 9: Week 10 billing next, or the Weeks 1–4 gaps first?

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
