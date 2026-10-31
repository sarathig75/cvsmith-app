# CVSmith API Contract (Week 1-2: Auth + CV upload stub)

Base URL: `http://localhost:8000`. All routes prefixed `/api`. JSON in/out unless noted.
Auth: `Authorization: Bearer <access_token>` on protected routes.

## Error format (all non-2xx)
```json
{ "error": { "code": "EMAIL_EXISTS", "message": "Human readable" } }
```
Codes: `VALIDATION_ERROR` (422), `EMAIL_EXISTS` (409), `INVALID_CREDENTIALS` (401), `UNAUTHORIZED` (401),
`INVALID_TOKEN` (400), `INVALID_CODE` (400), `RATE_LIMITED` (429), `EMAIL_FAILED` (503), `NOT_INVITED` (403), `UNSUPPORTED_FILE_TYPE` (415), `FILE_TOO_LARGE` (413), `NOT_FOUND` (404),
`GOOGLE_AUTH_FAILED` (401), `QUOTA_EXCEEDED` (402), `PRO_REQUIRED` (402), `SUGGESTION_FAILED` (503), `PDF_FAILED` (503), `SERVER_ERROR` (500).

## Types
```ts
User   = { id: string, email: string, email_verified: boolean, plan: "free" | "pro", created_at: string }
Token  = { access_token: string, token_type: "bearer", user: User }
CV     = { id: string, title: string, privacy: "private"|"public",
           parsing_status: "not_uploaded"|"pending"|"in_progress"|"complete"|"failed",
           parsing_error: string | null,   // user-facing message when parsing_status is "failed"
           parsing_parts: { contact: PartStatus, basics: PartStatus, experience: PartStatus, extras: PartStatus },
           json_resume: object,            // parser output only; JSON Resume subset; grows as parts complete ({} at first)
           content: object | null,         // the user's canvas, saved by PATCH /api/cv; null until first save
           applied_parts: ParsePart[],     // parsed parts already merged into content (client-managed)
           content_updated_at: string | null,
           created_at: string }
ParsePart  = "basics" | "experience" | "extras"
CVSave     = { content: object,            // the canvas draft as the frontend keeps it (opaque to the server)
               applied_parts: ParsePart[],
               edited?: boolean }          // true if the change includes a user edit (not only parsed data)
PartStatus = "pending" | "complete" | "failed"
SuggestionField = "summary" | "experience" | "projects" | "headline"
Suggestion = { id: string, field: SuggestionField, entry_id: string | null,  // entry_id: the canvas entry (job/project)
               original: string, suggested: string,
               changed: boolean,                    // false: the text already follows the house style
               status: "pending" | "accepted" | "declined" | "unchanged", created_at: string }
SuggestionRequest = { field: SuggestionField, entry_id?: string, text: string,   // text: the field as it is now
                      context?: { title?: string, company?: string } }          // helps for job/project descriptions
Quota = { plan: "free" | "pro", limit: number, used: number, remaining: number,
          resets_at: string }                  // 1st of next calendar month, 00:00 UTC
// Parts of json_resume each status covers:
//   contact    -> basics.email, basics.phone, basics.profiles (LinkedIn) found by pattern in the text,
//                 without AI, within about a second; overwritten by basics when that arrives.
//                 "complete" even if nothing was found (e.g. a scanned PDF). Absent on CVs parsed before it existed.
//   basics     -> basics (name, label, email, phone, url, location, profiles; not summary)
//   experience -> basics.summary, work, education
//   extras     -> skills, certificates, projects, languages, awards, volunteer, interests
```

## Endpoints
| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| GET | /api/health | no | - | 200 `{status:"ok"}` |
| POST | /api/auth/code | no | `{email}` | 200 `{message}`: a 6-digit login code is emailed (for any address; the answer never says whether an account exists). 429 `RATE_LIMITED` if the last code was sent under 60 s ago. 503 `EMAIL_FAILED` if the email could not be sent |
| POST | /api/auth/code/verify | no | `{email, code}` | 201 `Token` when this login created the account, else 200 `Token`. 400 `INVALID_CODE` for a wrong, expired, used or replaced code (the message says how many tries are left; 5 wrong tries end the code) |
| POST | /api/auth/signup | no | `{email, password}` | Off in Release 1 (`PASSWORD_LOGIN_ENABLED=false`): 404 `NOT_FOUND`. When on: 201 `Token` |
| POST | /api/auth/login | no | `{email, password}` | Off in Release 1: 404 `NOT_FOUND`. When on: 200 `Token` |
| POST | /api/auth/google | no | `{id_token}` (Google ID token) | 200 `Token` (creates user if new) |
| DELETE | /api/user | yes | `{confirm: "DELETE"}` | 204. Deletes the account, CV, uploaded file, suggestions and login codes; funnel events stay without the user link. Every session ends. 422 if `confirm` is not "DELETE" |
| POST | /api/auth/refresh | yes | - | 200 `Token` (a fresh 7-day token) |
| POST | /api/auth/logout | yes | - | 204 |
| GET | /api/user | yes | - | 200 `User` |
| POST | /api/cv/upload | yes | multipart `file` (PDF/DOCX, max 10MB) | 201 `CV` (parsing_status "pending"; parsing runs in the background, poll `GET /api/cv`) |
| GET | /api/cv | yes | - | 200 `CV` or 404 `NOT_FOUND` |
| GET | /api/suggestions/quota | yes | - | 200 `Quota` |
| POST | /api/suggestions | yes | `SuggestionRequest` | 201 `Suggestion`. 402 `QUOTA_EXCEEDED` when no suggestions are left this month (checked before any AI call). 422 `VALIDATION_ERROR` for empty text (except `headline` and `summary`, which may be empty: a headline is then written from the CV's current roles and summary, 422 if the saved CV has neither; a summary is written from the CV's roles, education, skills and job/project descriptions, 422 if the saved CV has none of these. A non-empty summary is only reworded: its content is kept, as it may be a positioning statement for the next role) or text over 5,000 characters. 503 `SUGGESTION_FAILED` if the AI call fails (not counted) |
| PATCH | /api/suggestions/{id} | yes | `{status: "accepted" \| "declined"}` | 200 `Suggestion`; 404 `NOT_FOUND` if it is not the user's |
| PATCH | /api/cv | yes | `CVSave` | 200 `CV`. Creates the CV (parsing_status "not_uploaded") if the user has none. 422 `VALIDATION_ERROR` if `content` is not an object, is larger than 256 KB as JSON, or `applied_parts` has unknown values |
| PATCH | /api/cv/privacy | yes | `{privacy: "private" \| "public"}` | 200 `CV`. Creates the CV (like PATCH /api/cv) if the user has none. 422 `VALIDATION_ERROR` for other values |
| DELETE | /api/cv | yes | - | 204. Deletes the CV (canvas, parsed data, uploaded file); the account stays and suggestions keep counting toward the month. 404 `NOT_FOUND` if there is no CV |
| GET | /api/cv/download | yes | - | 200 `application/pdf` of the saved `content` in the Classic template, `Content-Disposition: attachment` ("<Name> CV.pdf"). All plans. 404 `NOT_FOUND` if nothing is saved yet. 503 `PDF_FAILED` if the PDF cannot be made |
| GET | /api/cv/export | yes | - | 200 `application/json`: the saved `content` as JSON Resume v1.0.0, with `meta.cvsmith = {privacy, customSections?}`; attachment "<Name> CV.json". Pro only: 402 `PRO_REQUIRED` for free users. 404 `NOT_FOUND` if nothing is saved yet |

## Rules
- Password: min 8 chars, at least 1 letter and 1 number. Email normalized to lowercase.
- Sessions: the access token lasts 7 days and carries `ver` (`users.token_version`); `POST /api/auth/refresh` (auth) returns a fresh `Token`, called by the app while the user is active, so 7 days without activity end the session. Bumping the version ends every session.
- Invite-only mode (`INVITE_ONLY=true`, used for the pilot): `POST /api/auth/code`, `/api/auth/code/verify` and `/api/auth/google` answer 403 `NOT_INVITED` for addresses that are neither invited nor existing accounts. Invites are managed with `python -m app.cli invites add|remove|list`.
- Rate limits (429 `RATE_LIMITED`): login codes 5 per address and 20 per IP per hour; code checks and Google logins 30 per IP per 10 minutes. Skipped if Redis is unavailable.
- Release 1 logs in with a one-time email code (decided 2026-10-15): codes are 6 digits, valid 10 minutes,
  single use, replaced by a newer code, and stored only as a keyed hash. The first code login creates the
  account with `email_verified = true`; there is no separate verification step.
- Access token JWT (HS256), 7-day expiry, `sub` = user id, `ver` = token version; renewed with POST /api/auth/refresh while active.
- Passwords hashed with bcrypt; users signed up via Google have null password_hash; login with password for such users returns `INVALID_CREDENTIALS`.
- Google sign-in with an email that already has an account links to that account (Google must report the email as verified). If that account's email was never verified, its password is removed on linking, so only the Google owner can sign in; a verified account keeps its password.
- CV parsing is asynchronous: pending -> in_progress -> complete | failed. The upload never waits for it. Parsing first saves the `contact` part (pattern-based, instant), then runs three AI parts in parallel; each part's data is saved to `json_resume` and its `parsing_parts` entry set as soon as it finishes, while `parsing_status` is still `in_progress`, so clients can show parts early. `complete` = every part finished and at least one AI part (basics, experience, extras) succeeded (failed parts are `failed` in `parsing_parts`; `parsing_error` stays null). `failed` = no part succeeded, or the file could not be read (all parts `failed`, `parsing_error` set). `json_resume` uses JSON Resume field names for: basics (incl. location, profiles), work, education, skills, certificates, languages (`language`, `fluency`), awards (`title`, `awarder`, `date`, `summary`), volunteer (`organization`, `position`, `startDate`, `endDate`, `summary`, `highlights`), projects (`name`, `description`, `startDate`, `endDate`, `url`, `highlights`), interests (`name`, `keywords`). Empty fields are omitted; list sections are always present once parsed. Extension: `work[].current` (boolean) is true only when the CV states the role is ongoing.
- One CV per user in R1 (new upload replaces the existing record). A new upload also clears `content` and
  `applied_parts`: the new CV replaces the user's edits (the frontend asks the user to confirm first when
  `content` is not null).
- Saving: the frontend auto-saves about 2 s after the user stops editing. `json_resume` is written only by the
  parser and `content` only by PATCH, so a save and a finishing parse never overwrite each other. On load the
  frontend restores `content`, then merges parsed parts not in `applied_parts` (filling empty fields only).
  Last write wins between two open tabs. New CVs default `privacy = "public"`.
- "Improve all" (Pro, Canvas) is client-side: it asks `POST /api/suggestions` once per field (job and project
  descriptions, then summary, then headline, saving the canvas before the last two), applies each changed
  suggestion that has no `missing_details`, records `accepted`, and "Undo all" restores the text and records
  `declined`. The user confirms first, with the number of suggestions it may use. No new endpoint.
- QUOTA_EXCEEDED for a Pro user says all 50 are used (not "Upgrade to Pro").
- Suggestions (house style: `.claude/skills/cv-house-style/SKILL.md`): one request improves one whole field.
  Quota per calendar month (UTC): free 1, pro 50; only suggestions with `changed: true` count. Applying an
  accepted suggestion is done by the client (it replaces the field, then auto-saves); PATCH records the decision.
  Suggestion text is stored for the decision and deleted with the user.
- CORS origins from env `CORS_ORIGINS`; `Content-Disposition` is exposed so the browser can read download names.
- Downloads use the last saved `content`: the client saves pending edits first.
- No Apple sign-in in Release 1.

## Dashboard (built 2026-10-29)

Home for logged-in users (see `docs/USER_JOURNEYS.md`). Scores are computed on each read from
the saved CV (`content`); nothing is stored. The "before" ATS score is the one exception: it is
saved once when the CV is parsed (the uploaded file is deleted, so only numbers and check names
are kept). See the ATS section below for what is still open.

```ts
CvStrength = { percent: number,                 // 0-100, sum of section points
               sections: { key: "contact" | "summary" | "experience" | "education" | "skills"
                                 | "projects" | "others",
                           label: string, points: number, max: number, complete: boolean }[],
               next_step: { section: string, text: string, points: number } | null }
            // next_step: the lowest-scoring section that adds the most points; null at 100%

AtsScore = { score: number,                      // 0-100, Mode A (docs/ATS_FRAMEWORK.md)
             checks: { id: string, label: string, passed: boolean,
                       points: number,           // earned, on this mode's scale (A1 14, A2 14, ...)
                       max: number,              // what the check is worth
                       fix: string | null }[],   // null when passed; names the real check
             // Checks that do not apply are left out of `checks` and of the score (not zero).
             first_fix: { check_id: string, text: string, points: number } | null,
             framework: string }                // e.g. "ats-framework-v1"

Dashboard = { state: "no_cv" | "parsing" | "ready" | "needs_details",
              cv_strength: CvStrength | null,   // null when state is "no_cv"
              ats: AtsScore | null,             // current score; null when state is "no_cv"
              plan: "free" | "pro" }
```

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | /api/dashboard | yes | - | 200 `Dashboard`. `state` is "no_cv" when the user has no CV (404 is not used here); "parsing" while there is no saved canvas and `parsing_status` is pending or in_progress; "needs_details" when there is no saved canvas and parsing failed; "ready" otherwise. `cv_strength` and `ats` are null unless "ready". `ats` is also null if scoring failed (logged), never a made-up number |
| GET | /api/ats | yes | - | 200 `{ before: AtsScore \| null, after: AtsScore \| null }` for the Canvas. `before`: the uploaded file, scored when parsing finished (null if there was no upload, or it was uploaded before this existed). `after`: the saved CV (before the first save: the parsed upload). No CV: both null |
| POST | /api/next/viewed | yes | - | 204. Funnel step `next_viewed` (step only), sent when the "what next" page opens |

Rules:
- Points for CV strength, per section (proposal, to confirm before build):
  contact and headline 15 (name, email, headline); summary 10 (not empty); work experience 30
  (at least one role with title, employer and dates); education 10; skills 15 (at least 5);
  projects 10; certifications and others 10. The total is 100.
- `next_step.text` names the section and the points it adds, e.g. "Add two roles with dates to
  reach 90%". It never says "compliant" or promises a job outcome.
- The dashboard never shows a 0% score for "no_cv"; it shows the upload prompt instead.
- Job alignment is not part of this response. It has its own endpoints ("Job alignment" below).

### ATS format score

Framework and points: `docs/ATS_FRAMEWORK.md` (id `ats-framework-v1`). Mode A (CV only) is the dashboard
score; Mode B (with a job spec) is shown in job alignment. Word lists: `docs/ATS_RULES.md`
(code: `backend/app/services/ats/lists.py`).

Built 2026-10-29: Mode A and the dashboard/Canvas display. The Mode B scoring rules are in the code
(`ats/score.py`) and are used by job alignment (below).

On the Canvas the ATS card lists every check (points, fix) and is worked out again about 1.5 s after each
finished save (a PDF is only rendered again when the content changed).

How each check is measured (decisions the framework left open; change them here first):
- **Where facts come from.** Layout facts (A1, A2, A4, A11) are read from a file: the upload when it is
  parsed, and the PDF made from the saved CV (rendered with the same Chromium as the download; kept on the
  CV row with a hash of the content, so a PDF is only made again when the content changed). Only the numbers
  are kept; the upload is deleted as before. Text checks (A3, A5-A10) read the saved CV (`content`), or the
  parsed data (`json_resume`, mapped to the canvas shape) before the first save.
- **No file or no PDF.** If no layout is available (the PDF could not be made), A1, A2, A4 and A11 are
  left out as "not applicable"; the score is earned / applicable. A CV typed on the Canvas has no "before".
- **A1** text integrity: under 200 characters of text = unreadable (0); garbled characters (replacement or
  private-use) over 2% of the text, or over 40% of lines of two characters or fewer = scrambled (half
  points); otherwise ok.
- **A2** counts how many of Experience, Education and Skills appear as heading lines in the file's text
  (accepted variants in `lists.py`): 3 = full, 1-2 = half, 0 = none.
- **A4** is an estimate: Word files count tables, text boxes and drawings; in a PDF only images (as icons)
  can be counted, so tables and text boxes there are not detected. The check says "(estimated)".
- **A5** all dates one format (all month+year or all year-only) and every job has a start date, no end
  before its start = full; mixed formats = 4/9; a job without a start date, a non-date, an end before a
  start, or no jobs = 0.
- **A6-A10** read every bullet of every job and project description (a description without bullet marks
  counts each line). A strong verb matches in any form (managed, manages, managing). Only past-tense
  first words not on the list and not weak are recorded for review (kind `verb`).
- **A11** pages: from the PDF; for a Word upload only if the file states its page count.
- **First fix:** the applicable check that lost the most points; `points` is that loss on the 100 scale.
- **Unmatched terms** (`unmatched_terms`) are recorded once per upload, when the "before" score is made,
  never on each dashboard read.
- Mode B choices (not shown to users yet): B3 counts a skill in the latest role, or in a role that ended
  within 3 years, as recent (4); in older roles only 2 of 4 (stored as half); in the skills list only
  a quarter. B5 gives half points for a different rung of the same family and for the two related-family
  pairs named in `ATS_RULES.md` (only those two are listed; more pairs are added through review).

CV strength points are the proposal above, built as written, with partial credit for contact (5 points
each for name, email and headline), skills (3 points each up to 5) and a work role without all of title,
employer and dates (10 of 30).

### Data (migration 0010)

`cvs.ats_before` (JSON, nullable): `{score, checks, first_fix, framework, layout}` of the uploaded file, set when
parsing completes, cleared by a new upload. `cvs.ats_layout_after` (JSON, nullable): `{hash, layout}` of the PDF
made from `content`. `layout` = `{text, headings, tables, textboxes, icons, pages}`: numbers only.

## Job alignment (approved 2026-10-29; mocks in the design file, boards "Align to job")

Pro feature. The user pastes a job spec on `/align`; the result is on `/align/{id}`. A run shows the Mode B
score (docs/ATS_FRAMEWORK.md), a proposed headline (positioning), gaps, and ideas to consider. The user then
either updates the saved CV with the changes they ticked, or downloads a PDF with the same changes for this
job only. The saved CV is never changed by a run or by a download.

```ts
JobRequirements = { job_title: string, core_skills: string[], secondary_skills: string[],
                    years_required: number | null, needs_management: boolean,
                    sector: string | null }      // sector: a name from docs/ATS_RULES.md section 5, or null
Gap = { skill: string, importance: "core" | "secondary",
        status: "covered" | "missing",
        by_headline: boolean }                    // missing, but the proposed headline contains it
Alignment = { id: string, created_at: string,
              requirements: JobRequirements,      // what we read from the spec; the spec itself is not kept
              positioning: { current: string, proposed: string } | null,  // the headline; null: none that stays true to the CV
              summary: { current: string, proposed: string } | null,      // the professional summary, same rules; null on runs made before 2026-10-31
              gaps: Gap[],
              consider: string[],                 // ideas only, never added to the CV (at most 3)
              score: AtsScore }                   // Mode B of the saved CV; checks include B1-B7 that apply
Selection = { use_headline: boolean, use_summary: boolean,   // use_summary defaults to false
              skills: string[] }                             // skills: names of missing gaps to add
```

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | /api/alignment | yes | `{ job_spec: string }` (80-20000 chars) | 201 `Alignment`. 402 `PRO_REQUIRED` for Free; 402 `QUOTA_EXCEEDED` when the month's 50 are used; 404 `NOT_FOUND` if the user has no saved CV (`content` is null: open the Canvas first); 503 `ALIGNMENT_FAILED` if the AI step failed (nothing stored or counted) |
| GET | /api/alignment/{id} | yes | - | 200 `Alignment` (404 if not the user's) |
| POST | /api/alignment/{id}/preview | yes | `Selection` | 200 `AtsScore`: Mode B of the saved CV with the selection applied, recomputed by the rules (no AI). Used live while the user ticks |
| POST | /api/alignment/{id}/apply | yes | `Selection` | 200 `CV`: the selection is applied to the saved CV (headline and/or summary replaced; skills appended if not there already). The client then opens the Canvas |
| POST | /api/alignment/{id}/download | yes | `Selection` | 200 PDF of the saved CV with the selection applied, named "Jane Doe CV - Job title.pdf". Nothing is stored. PDF only: JSON export stays with the base CV |

Rules:
- One run = one suggestion of the monthly quota (`GET /api/suggestions/quota` counts both). Only runs that
  produced a result count. Pro only; a Free user gets `PRO_REQUIRED`.
- The job spec text is read once by the AI and not stored, logged or sent anywhere else. The run keeps the
  requirements (shown on the result) and the result.
- The AI reads the spec into `requirements`; everything scored afterwards is the fixed rules (Mode B). A second
  AI call writes the proposed headline and the ideas from the requirements and the CV's facts (not the spec),
  in the house style. The headline is dropped (`positioning: null`) if it names a skill, employer or person the
  CV does not contain (same guard as suggestions). Ideas never claim anything about the user's history.
- The proposed summary (added 2026-10-31) rewords and reorders the current summary and the CV's facts to lead
  with what the job asks for, using the job's wording where the facts support it; empty summary: written from
  the facts. It is dropped (`summary: null`) if it names a skill, employer or person the CV does not contain,
  contains a number the CV does not, contains any skill listed as missing (that would claim it), or is more
  longer than 500 characters and more than 1.5 times the current summary (plus 60 characters). Unchanged text is not a proposal.
- `skills` in a Selection must be names of `missing` gaps of that run; `use_headline` / `use_summary` need a
  proposal on that run; anything else is a 422.
- Nothing is added to the CV unless the user ticked it. "Dismiss" is only on the screen (not stored).
- Mode B unmatched terms (skill, title, sector, requirement kinds) are recorded for review once per run.
- Funnel events: `alignment_run` (step only); a job PDF records `pdf_downloaded` with `{"job_version": true}`.
- Data (migration 0011): table `alignment_runs` (id, user_id, cv_id, requirements, result, created_at), deleted
  with the user; `cv_id` is set to null when the CV is deleted (the run still counts toward the quota).

## Suggestion effectiveness and ATS monitoring (approved 2026-10-28)

Purpose: learn what suggestions and ATS rules do, without personal data leaving the database
except as counts and reviewed terms. Nothing here is shown to users. No new public endpoints:
reports are CLI commands for the admin (like `python -m app.cli invites`).

### Data

```ts
// Migration 0009. Suggestion table: one new nullable column.
suggestions.edited_at: timestamp | null   // first time the user changed the text after accepting

// New table. No user id, no CV content.
unmatched_terms = { id: uuid, kind: "title" | "sector" | "skill" | "verb" | "requirement",
                    term: string (≤60 chars, lower case, single spaces),
                    count: int, first_seen_at: timestamp, last_seen_at: timestamp,
                    status: "open" | "ignored" | "resolved" }
                  // unique (kind, term)
```

### Recording rules

- `record_unmatched(kind, raw)`: normalise (trim, lower case, collapse spaces). Drop the term if
  it is empty, longer than 60 characters, has more than 4 words, or contains a digit or "@".
  Otherwise insert or increment `count` and update `last_seen_at`. Never raises: failures are
  logged and ignored, so a user's action is never slowed or broken (same rule as funnel events).
- Recorded by the ATS scoring code, once per upload when the "before" score is made (built 2026-10-29).
- `ignored` items are never reported again. `resolved` = added to a list.

### Endpoints

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | /api/suggestions/{id}/edited | yes | - | 204. Records `edited_at` once, the first time the user changes the text of an accepted suggestion. Idempotent. 404 `NOT_FOUND` if the suggestion is not the user's or is not accepted. No text is stored or returned |

The client calls it once, when the user first edits a field whose suggestion they accepted. A
failed call is ignored; it never blocks editing.

### CLI (admin)

```
python -m app.cli suggestions report [--weeks 4]
  per field and week: accepted, declined, unchanged, pending (ignored), edited_after_accept
  counts only; no text, no user ids

python -m app.cli unmatched report [--min-count 5]
  open items with count ≥ min-count, grouped by kind, most seen first; prints term, count,
  first and last seen. Nearest existing canonical names shown for skill terms (close spelling)

python -m app.cli unmatched ignore "<kind>" "<term>"
python -m app.cli unmatched resolve "<kind>" "<term>"   # after the list or alias is added
```

Cadence: `unmatched report` weekly, `suggestions report` monthly.

### Evaluation set

- Location: `backend/evals/`. Cases in `cases.json`: 20–30 invented CVs (no real people), across
  software, HR, finance, sales, operations, manufacturing, automotive, pharma, FMCG and a fresher.
  Each case: the CV content, the field to improve, and expectations.
- Run on demand, never in pytest or CI (calls the real Claude API and costs credits):
  `cd backend && python -m evals.run_suggestions [--case ID] [--repeats N]`. Needs `ANTHROPIC_API_KEY`
  or `CVSMITH_CLAUDE_KEY`. Output varies between runs, so compare pass rates over 2 or more runs.
- Automated checks on every suggestion:
  1. no invented numbers: every number in the suggestion appears in the field or the CV
  2. no first person ("I", "my", "me")
  3. no invented content for an existing summary: suggestion ≤ 1.5 × the original length
  4. expectation: `changed` true or false as the case says (`null` = not asserted)
  6. no unlisted skills or employers: every capitalised word in the suggestion (except the first word
     of a sentence or bullet) appears in the field or the CV. No word limit is set for summaries.
  5. (retired 2026-10-28) the writer's "changed" flag. A suggestion is now a change when its text
     differs (`is_change`: whitespace and letter case alone are not changes). The flag is ignored,
     so a rewrite is never dropped.
- A case the API would refuse (e.g. an empty summary with no CV facts) is run through the same
  request rules (`prepare_request`, shared with the API) and recorded as "no change", not as a crash.
- Output: a summary per check, and one JSON file per run in `backend/evals/results/` (git-ignored),
  named by date and prompt hash (`cv_house_style` + `TASK` text). Results are compared across
  prompt versions by the same runner.
- Prompt version 3 (2026-10-28, approved): house-style rule 14 (an objective is replaced by a factual
  statement from the CV, or left unchanged if there are no facts). The task text had contradicted it
  and was aligned; the CV facts are now sent with every summary, so the writer has facts to replace
  an objective with. Results (2 runs, hash 09292fc3f0a0): no invented numbers 50/50, no first person
  50/50, expected change 50/50, no unlisted skills or employers 50/50, summary not longer 49/50 (the
  1.5× limit now applies to positioning statements only; an objective is replaced, so it may grow).
  Prompt caching is on for suggestions and for the CV parser: about 123,000 input tokens were read from
  the cache in one 50-result run, against none written in the second run.
- Pass rule: a prompt change is accepted only if no check regresses compared with the last run,
  measured over the same number of repeats.
- Prompt version 2 (2026-10-28, hash e182839854e6): weak-phrasing rules 12 and 13 added to the house
  style. No baseline yet: the Anthropic credit balance ran out, so the run could not be done. The
  `sales-projects-weak` and `auto-experience-weak` expectations are now not asserted.
  Result (2 runs, 50 results, hash e182839854e6): no invented numbers 50/50, no first person 49/50,
  summary not longer 48/50, expected change 47/50, no unlisted skills or employers 50/50. 29 of 50 were
  changes. Still failing: the objective summary (kept unchanged, with "I"), the fluff summary (rule 13
  not followed), and the pharma summary growth. The acronym expansion (rule 9) is allowed by the check.
- Baseline for prompt version 1 (2026-10-28, after the text-decides fix, 2 runs, prompt hash 61884741441e): no invented
  numbers 50/50, no first person 50/50, summary not longer 48/50, expected change 44/50.
  28 of 50 results were changes (22 before the fix). Only 2 of the 28 were trivial edits.

## Suggestion guard: missing details (approved 2026-10-28; built after this contract)

A suggestion can name a skill, employer or person that the CV does not contain. It is not rejected.
Instead the user is asked to add that detail to the CV first.

- `SuggestionOut` gains `missing_details: string[]`: the capitalised terms in `suggested_text` that
  do not appear in the field or the CV (the same rule as the evaluation check; the first word of a
  sentence or bullet and the spelled-out form of an acronym the CV uses are not counted). Empty when
  nothing is missing. Returned on the create response only; not stored.
- The suggestion keeps its status (`pending`), and the user can still accept it. The client shows a
  notice: "This suggestion mentions X, which is not in your CV yet. Add it to your experience first,
  or use the suggestion as it is."
- No change to quota: a suggestion with missing details is still a change and still counts.
- The check runs on the same request rules as the API (`prepare_request`); the rule lives in
  `app/services/suggestion_guard.py`, and the evaluation runner imports it, so both use one definition.
- Assumption to confirm: accepting is still allowed (the user decides). If you want it blocked until
  the details are added, say so.

## Name check while typing the Professional Summary (approved 2026-10-29; client-side, no API)

When the user leaves the Professional Summary field, the names in the summary that the rest of the
CV does not contain are listed in a note under the field: "Not in your CV yet: Contoso, Ltd. Add them
to your experience or skills first." It is a hint, not a block: nothing is changed or rejected. The
note is shown on leaving the field, and hidden when the field is focused again.
- Same rule as `suggestion_guard.py` (capitalised words, first word of a sentence or bullet skipped,
  spelled-out acronyms that the CV uses are allowed), ported to `frontend/src/utils/unlistedNames.ts`.
- The "known" words are the rest of the CV: the summary itself is not evidence.
- Only the summary for now. Experience and project descriptions can get the same note later if wanted.
- No API call, no stored data.
