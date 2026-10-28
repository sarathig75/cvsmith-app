# CVSmith user journeys (Release 1)

Status: agreed in discussion on 2026-10-28; design mockups for the dashboard and `/next` are
pending review. Not built yet. Screens and events are described here; the API is in
`docs/API_CONTRACT.md` (to be updated before code).

## Terms
- **CV strength**: a percentage from how complete the CV is (points per section, see below).
- **ATS format score**: the checklist score for the layout and structure of the CV (headings,
  single column, dates, contact details at the top). Not a job match, and not a promise of
  compliance with any real ATS.
- **Job alignment**: the optional job spec box. Separate from both scores.

## J1: New user, starts with a CV
1. **Start page (`/`):** enters an email, gets a 6-digit code, enters it. The account is created.
   The CV dropzone on the start page is uploaded when sign-up completes.
2. **Parsing starts in the background.** The user lands on the **Canvas** and sees sections fill
   in as they finish.
   - If parsing fails, the Canvas opens with a banner: "We couldn't read your CV automatically.
     You can enter your details below." Manual entry works.
3. **Canvas:** the user edits and uses 💡 suggestions. The Canvas shows the ATS format score
   before and after the suggestions.
4. **Download (PDF or JSON):** the file downloads and the user lands on **`/next`**. This happens
   after every download. The download is never blocked.
5. **`/next` (what next):**
   - a) Align your CV to a job spec (opens the job-alignment box on the dashboard)
   - b) CV strength: "Your CV is N% filled. Add [section] to reach 90%."
   - c) ATS format score: "Your ATS format score is N. Fix [check] to reach 95."
   - d) Go to dashboard
6. **Journey ends** when the user reaches the dashboard, or leaves the app. There is no Done
   button. A download is recorded as an event, not as a step the user must complete.

## J2: Returning user
1. **Login (email code):** the user enters the code.
2. **Has a CV (any state other than none):** lands on the **dashboard**. A CV still parsing, or
   one that needs manual entry, shows that status on the dashboard.
3. **No CV yet:** the dashboard shows an **upload prompt** instead of a score. The landing screen
   for this case is still to be confirmed (see open points).
4. The user continues from the dashboard (edit on the Canvas, or align to a job).

## Dashboard (home for logged-in users)
- **CV strength:** percentage, progress bar, and the note "Complete CVs are easier for recruiters
  to read and search."
- **Next step:** one line from the lowest-scoring section, for example "Add two roles with dates
  to reach 90%."
- **ATS format score (current):** the number for the saved CV, with its first fix. The full list
  is on the Canvas.
- **Align to a job:** the job-spec box from the agreed mockup. Before a run, it shows the **sample
  result** (invented data, labelled). Accepting a suggestion changes the saved CV.
- **Links:** Canvas, Download PDF, Export JSON (Pro).
- **No CV:** the upload prompt replaces all scores.

## Points for CV strength (proposal, to confirm)
| Section | Points | Complete when |
|---|---|---|
| Contact and headline | 15 | name, email, headline |
| Professional summary | 10 | not empty |
| Work experience | 30 | at least one role with title, employer and dates |
| Education | 10 | at least one entry |
| Skills | 15 | at least 5 skills |
| Projects | 10 | at least one project |
| Certifications and others | 10 | at least one entry |

## Rules
- Every suggestion (ATS fix, CV strength step) names the real check or section that fails.
  Adding "fields" alone is not a fix.
- Scores are never called compliance. Use "format score" and "CV strength".
- Free plan: job alignment shows the sample result with an upgrade button. Pro: runs the alignment.
- Analytics: each step is recorded once per user with the step, time and plan only. Never CV
  content, names, emails or file names (see `docs/FUNNEL.md`).

## Open points
- J2c: the agreed answer to "no CV" is the upload prompt on the dashboard. Should a user with no
  CV land on the dashboard (with the prompt), or on the Canvas (with an upload banner)?
- Job alignment and ATS stay separate from CV strength (agreed).
- Dashboard mockup and `/next` mockup: pending review.
