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
| POST | /api/suggestions | yes | `SuggestionRequest` | 201 `Suggestion`. 402 `QUOTA_EXCEEDED` when no suggestions are left this month (checked before any AI call). 422 `VALIDATION_ERROR` for empty text (except `headline`, which may be empty: a headline is then written from the CV's current roles and summary; 422 if the saved CV has neither) or text over 5,000 characters. 503 `SUGGESTION_FAILED` if the AI call fails (not counted) |
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
