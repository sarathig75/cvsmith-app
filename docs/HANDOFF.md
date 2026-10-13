# CVSmith handoff

Updated: 2026-10-13 · Last commit on main: see `git log -1 origin/main` (this note is merged
together with the canvas work: "docs: update handoff").

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
  etc.) apply to Suggestions only; they are in the plan doc under Week 7–8.
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
- Parser verified against the real Claude API on 5 real CVs (Word, two-column PDF, fresher,
  one-pager): all parse. Two parallel requests per CV (one schema with every section exceeds the
  API's grammar size limit). ~$0.03–0.07 and 4–24 s per CV.
- Scanned-PDF path (Claude reads the PDF directly) is still untested with a real scan.
- Open branches / PRs: none besides the session branch, which is merged into main.

## Done this session
- Verified the API key (`CVSMITH_CLAUDE_KEY`) works for Sonnet and Opus.
- Fixed real parsing: every call had failed with 400 "compiled grammar is too large" (bcd1b1b).
- Sonnet vs Opus comparison on 5 CVs; kept Sonnet.
- Writing rules for suggestions + ATS-readable PDF template item in the plan (67edf90).
- Parsing in two parallel requests; new sections languages, awards, volunteer, projects,
  interests; rules against repeated roles, invented jobs and dropped content (f830b90).
- Canvas regrouped into five groups, Others with typed items, headline, education score,
  skills as tags (92ae610, b2f19c0); plan doc records the layout and re-order suggestions (8f4b182).

## Next steps
1. Build progressive parsing (approved by the user 2026-10-13). Contract first, then code:
   - Three parallel requests: basics (fast) / work + education / skills, certificates,
     projects and Others. Save each part to `json_resume` as soon as it finishes.
   - Contract: a CV can be partly parsed (e.g. per-part status, so the canvas knows which
     groups are still filling and which failed). Keep "complete" meaning all parts done.
   - Canvas: fill each group when its part arrives (merge already fills only empty fields);
     show "Filling in…" on waiting groups; a failed part says "please fill in manually"
     while the other parts are kept.
   - Measure: time to first filled group and total time, before vs after, on the 5 test CVs.
   - Cost: ~+$0.01 per CV (the CV is sent three times).
2. Parsing quality: a CV with many unattached sections gets a very long summary (one test CV:
   4,700 chars); bullets covering a whole employer land under its latest title. Decide where
   such text belongs, then adjust the prompt and re-run the 5 CVs on Sonnet (~$0.15).
3. Test a real scanned PDF and a full upload through the running app (docker-compose).
4. Week 5–6: save canvas edits to the backend (PATCH /api/cv) and session restore.
5. Draft a "CV house style" skill from the writing rules, for cv-writer / cv-jd-tailor and Suggestions.

## Open questions for the user
- Where should text that belongs to no single role go (summary vs a new place)?

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
