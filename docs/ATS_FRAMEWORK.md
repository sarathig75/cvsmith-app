# ATS score framework (agreed 2026-10-28; framework id `ats-framework-v1`)

The ATS score measures how well the CV is written for applicant tracking systems. It is CVSmith's own
checklist, not a real ATS's score, and it is never called "compliance". CV strength (completeness) is a
separate score.

Two modes on one 100-point scale:
- **Mode A, CV only (dashboard):** 100 points, checks A1 to A11.
- **Mode B, with a job spec (job alignment):** 60 points from checks A1 to A11 (scaled down), plus
  40 points from job-match checks B1 to B7.

Word lists (action verbs, passive phrases, aliases, title ladders, sector terms) are in `docs/ATS_RULES.md`.

## Rules for every mode
- **Deterministic.** The AI model is used only to read the job spec once, to extract its requirements
  (core skills, secondary skills, years, title, whether management is needed, sector terms). The extracted
  requirements are saved with each run and shown to the user. All scoring after that is fixed rules.
- **Not applicable is removed, not zero.** A check that does not apply (no years in the job spec, no
  management in the job spec, a title or sector not on any list) is left out. The score is then
  earned points divided by the applicable total, times 100. Unmatched items are counted for review
  (`docs/ATS_RULES.md`, section 6–7); the user is not told.
- **Which file each check reads.** Layout checks (A1, A4) read the uploaded file, saved when it is parsed
  (the "before" score), and the generated PDF (the "after" score). Text checks read the text extracted from
  that file or the saved CV.
- **Metrics.** Numbers, percentages and currency count as metrics. Years used as dates do not.
- **Reference date.** The server's date, used for "3 or more years ago".
- **First fix.** The applicable check with the most points lost. Ties go to the earlier check in the list.
  The dashboard shows this as its single fix.

## Mode A: CV only (100 points)

| # | Check | Pts | Rule |
|---|---|---|---|
| A1 | Text extraction integrity | 14 | 14 if the text reads in order; 7 if some text is scrambled; 0 if unreadable (e.g. scanned PDF) |
| A2 | Standard section headings | 14 | 14 if all headings are standard (Experience, Education, Skills); 7 if mixed; 0 if missing |
| A3 | Contact completeness | 11 | name 2, email 3, phone 2, location 2, LinkedIn or portfolio 2 |
| A4 | Layout traps | 8 | start at 8; minus 2 per table, 2 per text box, 1 per icon used in place of text; floor 0 |
| A5 | Date consistency | 9 | 9 if one format and a consistent timeline; 4 if mixed; 0 if dates are missing or broken |
| A6 | Action verb strength | 11 | 11 if 80% or more of bullets start with a listed verb; 5 if 50–79%; 0 below 50% |
| A7 | Quantified achievements | 11 | 11 if 40% or more of bullets have a metric; 5 if 20–39%; 0 below 20% |
| A8 | Passive phrasing | 7 | 7 for none; 3 for 1–3; 0 for more than 3 |
| A9 | Bullet length | 5 | 5 if 80% or more are 15–30 words; 2 if 50–79%; 0 below 50% |
| A10 | Verb repetition | 4 | 4 if no verb starts more than 4 bullets; 0 otherwise |
| A11 | Length vs experience | 6 | 6 if the page count fits the years of experience (under 5 years: 1 page; 5–15: up to 2; over 15: up to 3); 3 if one band off; 0 otherwise |

Total: 100.

## Mode B: with a job spec (100 points)

Checks A1 to A11 at reduced points: A1 9, A2 8, A3 6, A4 5, A5 5, A6 6, A7 6, A8 4, A9 3, A10 2, A11 6 (total 60).

Job-match checks:

| # | Check | Pts | Rule |
|---|---|---|---|
| B1 | Core must-have skills | 14 | (matched core skills ÷ total core skills) × 14. Matching uses the alias list |
| B2 | Secondary skills | 6 | (matched secondary ÷ total secondary) × 6 |
| B3 | Skill recency | 4 | 4 if a core skill is in the most recent role; 2 if only in roles 3 or more years old; 1 if only in the skills list |
| B4 | Years of experience | 6 | 6 if the CV meets the required years; 3 if 1–2 years short; 0 if more than 2 years short. Not applicable if the job spec gives no number |
| B5 | Title similarity | 6 | 6 if the current or a recent title is the job title or its direct precursor on the ladder; 3 if related family; 0 if unrelated. Not applicable if the job title is not on a ladder |
| B6 | Management scope | 2 | 2 if the spec asks for management and the CV gives team size or budget; 1 if leadership is mentioned without numbers; 0 if missing. Not applicable if the spec does not ask |
| B7 | Sector terms | 2 | 2 if 50% or more of the sector terms appear; 1 if 25–49%; 0 below 25%. Not applicable if the sector has no list |

Total: 60 + 40 = 100.

## Build status
Built 2026-10-29: the word lists (`backend/app/services/ats/lists.py`), Mode A and Mode B scoring
(`backend/app/services/ats/`), the dashboard and the Canvas before/after score (Mode A). Mode B has no
endpoint or screen yet: job alignment is paused. How each check is measured in code:
`docs/API_CONTRACT.md`, "ATS format score".
