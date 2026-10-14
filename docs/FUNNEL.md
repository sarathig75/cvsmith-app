# CVSmith funnel report

Where do users drop off? Each step a user reaches is one row in the `events` table
(see "Funnel tracking" in `CVSmith_Release_1_FINAL_PLAN.md`). Events hold only the step, the
time, the user id and small metadata; never CV content, names, emails or file names.

| Step | Recorded when | Metadata |
|---|---|---|
| `signup` | an account is created (email or first Google sign-in) | `method` |
| `email_verified` | the email is verified, or Google confirms it (once per user) | `method` |
| `cv_uploaded` | a CV file is uploaded (every upload) | `file_type` |
| `parsing_finished` | a parse job ends (every parse) | `status`, `failed_parts` |
| `first_edit` | the first save that contains a user edit (once per user) | none |
| `suggestion_requested` | a 💡 suggestion was written (every one, incl. "no change needed") | `field`, `changed` |
| `upgrade_prompt_shown` | a suggestion was refused because the monthly quota is used | `field` |

Later steps (`upgraded`, `pdf_downloaded`) are added with their features.

## Report: distinct users per step, by signup week

Run against the production database (Postgres). Users are grouped by the week they signed
up, so each row is a cohort; `pct_*` is the share of that cohort that reached the step.

```sql
WITH cohort AS (
    SELECT user_id, date_trunc('week', min(created_at)) AS signup_week
    FROM events
    WHERE event_type = 'signup' AND user_id IS NOT NULL
    GROUP BY user_id
),
reached AS (
    SELECT DISTINCT user_id, event_type
    FROM events
    WHERE user_id IS NOT NULL
)
SELECT
    c.signup_week::date AS week,
    count(*) AS signed_up,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'email_verified')) AS verified,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'cv_uploaded')) AS uploaded,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'parsing_finished')) AS parsed,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'first_edit')) AS edited,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'suggestion_requested')) AS suggested,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'upgrade_prompt_shown')) AS hit_quota,
    round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'cv_uploaded')) / count(*), 1) AS pct_uploaded,
    round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM reached r WHERE r.user_id = c.user_id AND r.event_type = 'first_edit')) / count(*), 1) AS pct_edited
FROM cohort c
GROUP BY c.signup_week
ORDER BY c.signup_week DESC;
```

Notes:
- Steps are counted per user, so repeated uploads or parses do not inflate the numbers.
- Users can skip steps (e.g. edit without uploading), so the columns need not decrease.
- Parsing failures: `SELECT metadata->>'status', count(*) FROM events WHERE event_type =
  'parsing_finished' GROUP BY 1;`
- Suggestions accepted vs declined (the decision is kept on each suggestion, not in events):
  `SELECT field, status, count(*) FROM suggestions GROUP BY 1, 2 ORDER BY 1, 2;`
