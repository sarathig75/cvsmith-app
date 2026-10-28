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
- Suggestions (house style: `.claude/skills/cv-house-style/SKILL.md`): one request improves one whole field.
  Quota per calendar month (UTC): free 1, pro 50; only suggestions with `changed: true` count. Applying an
  accepted suggestion is done by the client (it replaces the field, then auto-saves); PATCH records the decision.
  Suggestion text is stored for the decision and deleted with the user.
- CORS origins from env `CORS_ORIGINS`; `Content-Disposition` is exposed so the browser can read download names.
- Downloads use the last saved `content`: the client saves pending edits first.
- No Apple sign-in in Release 1.

## Dashboard (planned 2026-10-28; not built yet)

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

AtsScore = { score: number,                      // 0-100, format checklist (see open decision)
             checks: { id: string, label: string, passed: boolean,
                       points: number, fix: string | null }[],
             first_fix: { check_id: string, text: string, points: number } | null,
             framework: string }                // version of the checklist, e.g. "ats-format-v1"

Dashboard = { state: "no_cv" | "parsing" | "ready" | "needs_details",
              cv_strength: CvStrength | null,   // null when state is "no_cv"
              ats: AtsScore | null,             // current score; null when state is "no_cv"
              plan: "free" | "pro" }
```

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | /api/dashboard | yes | - | 200 `Dashboard`. `state` is "no_cv" when the user has no CV (404 is not used here); "parsing" while `parsing_status` is pending or in_progress; "needs_details" when parsing failed; "ready" otherwise |

Rules:
- Points for CV strength, per section (proposal, to confirm before build):
  contact and headline 15 (name, email, headline); summary 10 (not empty); work experience 30
  (at least one role with title, employer and dates); education 10; skills 15 (at least 5);
  projects 10; certifications and others 10. The total is 100.
- `next_step.text` names the section and the points it adds, e.g. "Add two roles with dates to
  reach 90%". It never says "compliant" or promises a job outcome.
- The dashboard never shows a 0% score for "no_cv"; it shows the upload prompt instead.
- Job alignment is not part of this response. It gets its own endpoints when built.

### ATS format score: open decision

Still to decide with the user before this section is final:
- the checklist and its points (proposal in the handoff: single column, text layer, standard
  headings, contact at top, simple bullets, consistent dates, no tables or images, file size);
- how completeness is scored, so the single-column export does not always look ready;
- which checks are heuristics (columns, tables) and how they are labelled.

Until then, `checks` and `score` are returned as the framework's current draft and `framework` names
its version, so the client never shows a number from an undecided checklist.

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
- Recorded only by the ATS scoring code (not built yet; step 1e). The store is built now so the
  scoring code has somewhere to write.
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
  5. the flag agrees with the text: if the writer says nothing changed, the text must be the same
     (otherwise the user sees no suggestion for a rewrite the writer produced)
- A case the API would refuse (e.g. an empty summary with no CV facts) is run through the same
  request rules (`prepare_request`, shared with the API) and recorded as "no change", not as a crash.
- Output: a summary per check, and one JSON file per run in `backend/evals/results/` (git-ignored),
  named by date and prompt hash (`cv_house_style` + `TASK` text). Results are compared across
  prompt versions by the same runner.
- Pass rule: a prompt change is accepted only if no check regresses compared with the last run,
  measured over the same number of repeats.
- Baseline (2026-10-28, 2 runs, prompt hash 61884741441e): no invented numbers 50/50, no first
  person 50/50, summary not longer 48/50, expected change 40/50, flag agrees with text 42/50.
  Consistent failures are listed in the handoff, not changed here.
