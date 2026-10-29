# CVSmith privacy notice (DRAFT)

> Draft for review: this is legal text. The operator must review it (ideally with an adviser)
> and fill every placeholder before real testers are invited. Shown in the app at `/privacy`.
> Edit the text in `frontend/src/pages/privacyText.ts`, then regenerate this file with
> `cd frontend && npx vite-node scripts/privacy-md.ts` (a test fails if the two differ).

## Placeholders to fill
- [ ] [DATE OF LAST UPDATE]
- [ ] [OPERATOR NAME]
- [ ] [CONTACT EMAIL]
- [ ] [ANTHROPIC PRIVACY LINK]
- [ ] [RESEND PRIVACY LINK]
- [ ] [GOOGLE PRIVACY LINK]
- [ ] [HOSTING PROVIDER, REGION]
- [ ] [HOSTING PRIVACY LINK]
- [ ] [APPLICABLE LAW, for example India’s Digital Personal Data Protection Act, 2023 — to be confirmed by the operator.]

---

Last updated: [DATE OF LAST UPDATE]

## Who we are

CVSmith is run by [OPERATOR NAME]. This is a private beta (pilot): only invited people can use it.

Questions about your data, or requests to see or delete it: [CONTACT EMAIL].

## What we collect

- Your email address, to log you in with a one-time code.
- Your CV: the file you upload and everything we read from it or you type in (for example contact details, work history, education, skills).
- The suggestions you ask for, whether you used them, and whether you changed the text afterwards (we count the change; we do not keep the changed text).
- On Pro, the job descriptions you paste to align your CV to a job. We keep only what we read from them (job title, skills asked for, years, sector) and the result (proposed headline, gaps, ideas), never the pasted text itself.
- Your CV scores (CV strength and ATS format score). They are worked out from your CV when you open the dashboard or the editor. For the file you upload, we keep its score (numbers and the names of the checks only) after the file itself is deleted.
- Words from your CV that our checks do not recognise, such as an unusual skill, job title or action verb. We store only the word and how often we have seen it, so we can improve the checks. A stored word has no link to you: never your name, contact details or the CV it came from. Anything with a digit or an @ sign, or longer than four words, is never stored.
- Which steps you have reached (for example signed up, uploaded a CV, downloaded a PDF), to see where the product needs work. These records never contain your CV content.
- Basic technical logs kept by our server (for example the time of a request and your IP address), to keep the service running and secure.

## How we use it

- To read your CV and fill in the editor for you.
- To write the suggestions you ask for, and the job alignments you run.
- To work out your CV strength and ATS format score, and to suggest what to fix first.
- To create your PDF and, on Pro, your JSON export.
- To send you login codes.
- To improve CVSmith, using the step records and the unrecognised words described above.

We do not sell your data and we do not use it for advertising.

## Service providers

We use a few providers to run CVSmith. They handle your data only to provide their service to us:

- Anthropic (Claude API): receives the text of your CV to read it and to write suggestions, and the job descriptions you paste to align your CV. Their privacy policy: [ANTHROPIC PRIVACY LINK].
- Resend: sends login emails, so it receives your email address. Their privacy policy: [RESEND PRIVACY LINK].
- Google: only if you choose "Sign in with Google". Their privacy policy: [GOOGLE PRIVACY LINK].
- [HOSTING PROVIDER, REGION]: the servers where CVSmith and its database run. Their privacy policy: [HOSTING PRIVACY LINK].

## How long we keep it

- The file you upload is deleted as soon as we have read it.
- Your CV and its scores stay until you replace it or delete it.
- Settings → Delete my CV removes your CV straight away. Settings → Delete my account removes your account, CV, scores, suggestions and job alignments straight away.
- Database backups are kept for 14 days, so deleted data also disappears from backups within 14 days.
- Step records and unrecognised words are kept after you delete your account, but without any link to you.

## Who can see your CV

Only you. The "Public" setting is saved for a recruiter search that does not exist yet; during the pilot nobody else can see your CV.

## Your choices

- See and correct your data at any time in the editor.
- Download it as a PDF (and as JSON on Pro).
- Delete your CV or your whole account in Settings.
- For anything else, write to [CONTACT EMAIL].

## Changes and applicable law

If we change this notice, we will tell pilot users by email before the change applies.

[APPLICABLE LAW, for example India’s Digital Personal Data Protection Act, 2023 — to be confirmed by the operator.]
