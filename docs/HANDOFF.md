# CVSmith handoff

Updated: 2026-10-13 · Last commit on main before this note: fd6ced6 feat(skills): expand known
abbreviations automatically, leave unknown ones

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
- Release 2: current-employer shield for recruiter search (see plan doc).

## Current state
- Backend: pytest 68/68 passing, flake8 clean.
- Frontend: type-check clean, vitest 46/46 passing, `vite build` OK.
  (Checks last run at b2f19c0; later commits change only docs and the skill.)
- Parser verified against the real Claude API on 5 real CVs (Word, two-column PDF, fresher,
  one-pager): all parse. Two parallel requests per CV (one schema with every section exceeds the
  API's grammar size limit). ~$0.03–0.07 and 4–24 s per CV.
- Scanned-PDF path (Claude reads the PDF directly) is still untested with a real scan.
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

## Next steps
1. Progressive parsing is built (see Done). Next: watch it in the running app with a real upload.
2. Parsing quality: bullets covering a whole employer land under its latest title (open).
   Text that belongs to no single role stays in the summary (user decision 2026-10-13, option a).
3. Test a real scanned PDF and a full upload through the running app (docker-compose).
4. Week 5–6: save canvas edits to the backend (PATCH /api/cv) and session restore.
5. Week 7–8 Suggestions: build its prompt from `.claude/skills/cv-house-style/SKILL.md`.

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
- Full stack: `docker-compose.yml` (Postgres, Redis, backend, Celery worker, frontend).
- `cv-house-style` exists twice: the repo copy (master) and the user's claude.ai upload, which
  Claude cannot update. After any rule change: zip the folder
  (`cd .claude/skills && zip -r cv-house-style.zip cv-house-style`), send it to the user, and
  remind them to re-upload it in claude.ai.
