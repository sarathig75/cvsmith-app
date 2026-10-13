# CVSmith API Contract (Week 1-2: Auth + CV upload stub)

Base URL: `http://localhost:8000`. All routes prefixed `/api`. JSON in/out unless noted.
Auth: `Authorization: Bearer <access_token>` on protected routes.

## Error format (all non-2xx)
```json
{ "error": { "code": "EMAIL_EXISTS", "message": "Human readable" } }
```
Codes: `VALIDATION_ERROR` (422), `EMAIL_EXISTS` (409), `INVALID_CREDENTIALS` (401), `UNAUTHORIZED` (401),
`INVALID_TOKEN` (400), `UNSUPPORTED_FILE_TYPE` (415), `FILE_TOO_LARGE` (413), `NOT_FOUND` (404),
`GOOGLE_AUTH_FAILED` (401), `SERVER_ERROR` (500).

## Types
```ts
User   = { id: string, email: string, email_verified: boolean, created_at: string }
Token  = { access_token: string, token_type: "bearer", user: User }
CV     = { id: string, title: string, privacy: "private"|"public",
           parsing_status: "pending"|"in_progress"|"complete"|"failed",
           parsing_error: string | null,   // user-facing message when parsing_status is "failed"
           parsing_parts: { basics: PartStatus, experience: PartStatus, extras: PartStatus },
           json_resume: object,            // JSON Resume subset; grows as parts complete ({} at first)
           created_at: string }
PartStatus = "pending" | "complete" | "failed"
// Parts of json_resume each status covers:
//   basics     -> basics (name, label, email, phone, url, location, profiles; not summary)
//   experience -> basics.summary, work, education
//   extras     -> skills, certificates, projects, languages, awards, volunteer, interests
```

## Endpoints
| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| GET | /api/health | no | - | 200 `{status:"ok"}` |
| POST | /api/auth/signup | no | `{email, password}` | 201 `Token` |
| POST | /api/auth/login | no | `{email, password}` | 200 `Token` |
| POST | /api/auth/google | no | `{id_token}` (Google ID token) | 200 `Token` (creates user if new) |
| POST | /api/auth/logout | yes | - | 204 |
| GET | /api/user | yes | - | 200 `User` |
| POST | /api/auth/send-verification | yes | - | 202 `{message}` |
| POST | /api/auth/verify | no | `{token}` | 200 `User` |
| POST | /api/cv/upload | yes | multipart `file` (PDF/DOCX, max 10MB) | 201 `CV` (parsing_status "pending"; parsing runs in the background, poll `GET /api/cv`) |
| GET | /api/cv | yes | - | 200 `CV` or 404 `NOT_FOUND` |

## Rules
- Password: min 8 chars, at least 1 letter and 1 number. Email normalized to lowercase.
- Signup/login/google never block on email verification.
- Access token JWT (HS256), 24h expiry, `sub` = user id. No refresh tokens in R1.
- Passwords hashed with bcrypt; users signed up via Google have null password_hash; login with password for such users returns `INVALID_CREDENTIALS`.
- Google sign-in with an email that already has an account links to that account (Google must report the email as verified). If that account's email was never verified, its password is removed on linking, so only the Google owner can sign in; a verified account keeps its password.
- CV parsing is asynchronous: pending -> in_progress -> complete | failed. The upload never waits for it. Parsing runs in three parts in parallel; each part's data is saved to `json_resume` and its `parsing_parts` entry set as soon as it finishes, while `parsing_status` is still `in_progress`, so clients can show parts early. `complete` = every part finished and at least one succeeded (failed parts are `failed` in `parsing_parts`; `parsing_error` stays null). `failed` = no part succeeded, or the file could not be read (all parts `failed`, `parsing_error` set). `json_resume` uses JSON Resume field names for: basics (incl. location, profiles), work, education, skills, certificates, languages (`language`, `fluency`), awards (`title`, `awarder`, `date`, `summary`), volunteer (`organization`, `position`, `startDate`, `endDate`, `summary`, `highlights`), projects (`name`, `description`, `startDate`, `endDate`, `url`, `highlights`), interests (`name`, `keywords`). Empty fields are omitted; list sections are always present once parsed. Extension: `work[].current` (boolean) is true only when the CV states the role is ongoing.
- One CV per user in R1 (new upload replaces the existing record). New CVs default `privacy = "public"`.
- CORS origins from env `CORS_ORIGINS`.
- No Apple sign-in in Release 1.
