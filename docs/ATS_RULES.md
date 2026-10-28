# ATS score: fixed lists (DRAFT for review)

Status: draft written 2026-10-28 for review. Not used by the app yet. The framework is in the
ATS section of `docs/API_CONTRACT.md` (to update) and was agreed on 2026-10-28: Mode A (CV only,
100 points) and Mode B (with a job spec, 60 + 40 points).

Rules for every list: lower case when matching; match whole words; spelling is UK English.
Each list is a plain file in the backend, with a test that checks no word appears in two lists.

---

## 1. Action verbs (check A6)

A bullet "starts with a strong verb" when its first word is in this list (past tense for past
roles, present tense for the current role; the matcher accepts both forms).

accelerated, achieved, administered, analysed, architected, automated, built, consolidated,
created, cut, defined, delivered, designed, developed, directed, drove, eliminated, established,
expanded, forecast, generated, grew, implemented, improved, increased, initiated, introduced,
launched, led, managed, migrated, modernised, negotiated, optimised, orchestrated, owned, piloted,
planned, recruited, redesigned, reduced, resolved, restructured, scaled, secured, simplified,
standardised, streamlined, supervised, transformed, trained, validated

Not on the list (weak or filler): responsible, assisted, helped, supported, worked, involved,
participated, handled, contributed, familiar, various.

## 2. Passive and filler phrases (check A8)

Counted anywhere in a bullet, case-insensitive:

responsible for; assisted with; assisted in; helped with; helped the team; worked on;
involved in; participated in; in charge of; duties included; duties were; tasked with;
was part of; part of the team; dealt with; exposed to; familiar with; good knowledge of;
hard-working; detail-oriented; various; etc.

## 3. Alias list (checks B1, B2)

Each row is one skill. Any listed form counts as a match.

| Skill (canonical) | Also matches |
|---|---|
| React | React.js, ReactJS |
| Node.js | Node, NodeJS |
| Kubernetes | K8s |
| JavaScript | JS |
| TypeScript | TS |
| PostgreSQL | Postgres |
| Machine learning | ML |
| Amazon Web Services | AWS |
| Google Cloud | GCP, Google Cloud Platform |
| Microsoft Excel | Excel, MS Excel |
| Power BI | PowerBI |
| CI/CD | continuous integration, continuous delivery, continuous deployment |
| Stakeholder management | stakeholder engagement |
| Human resources information system | HRIS |
| Applicant tracking system | ATS (only in HR context) |
| Six Sigma | 6 Sigma, Lean Six Sigma |
| OEE | overall equipment effectiveness |
| ISO 9001 | ISO9001 |
| Preventive maintenance | PM schedule, planned maintenance |

Open for review: the list is short on purpose. We add a row only when a real CV or job spec shows
a miss.

## 4. Title map (check B5)

Each job family has a ladder. A title matches the job spec title when it is the same rung, or the
rung directly below in the same family ("direct or immediate precursor" = 6 points). A title in a
related family is worth 3 points. Anything else is 0.

| Family | Ladder (lowest to highest) |
|---|---|
| Software engineering | Junior engineer → Engineer → Senior engineer → Lead engineer / Staff engineer → Engineering manager / Architect |
| Data | Data analyst → Senior data analyst → Data scientist → Senior data scientist → Lead data scientist / Head of data |
| Product | Associate product manager → Product manager → Senior product manager → Group product manager / Head of product |
| Human resources | HR executive → HR generalist → HR business partner → Senior HR business partner → HR manager → HR director → Chief HR officer |
| Finance | Accountant → Senior accountant → Finance manager → Finance director → CFO |
| Sales | Sales executive → Account manager → Senior account manager → Sales manager → Head of sales |
| Operations | Operations executive → Operations manager → Senior operations manager → Operations director |
| Marketing | Marketing executive → Marketing manager → Senior marketing manager → Marketing director |
| Manufacturing production | Production associate → Production supervisor → Production engineer → Senior production engineer → Plant manager → Plant head / Director of manufacturing |
| Manufacturing quality | QA inspector → Quality engineer → Senior quality engineer → Quality manager → Head of quality |
| Maintenance and reliability | Maintenance technician → Maintenance engineer → Senior maintenance engineer → Maintenance manager → Head of maintenance |

Related families (3 points): for example HR business partner and Operations manager, or Data
analyst and Finance manager. Each pair must be listed explicitly; no guessing.

Open for review: confirm the families we need at launch. This draft is a starting point and is
not exhaustive.

## 5. Sector terms (check B7)

The job spec's domain terms are read once by the AI step. Each sector below has a starter list
used to count how many of those terms the CV contains. Sectors need your confirmation before we
use them.

| Sector | Starter terms |
|---|---|
| Human resources | talent acquisition, employee relations, performance management, workforce planning, learning and development, compensation and benefits, onboarding, HR policy, compliance, succession planning |
| Software | API, microservices, testing, code review, deployment, cloud, databases, security, agile, scalability |
| Finance | budgeting, forecasting, reconciliation, reporting, audit, cash flow, compliance, variance analysis, IFRS, GAAP |
| Sales | pipeline, quota, account management, negotiation, revenue, CRM, prospecting, retention, forecasting |
| Operations | supply chain, logistics, process improvement, inventory, vendor management, KPIs, lean, quality |
| Manufacturing | lean manufacturing, Six Sigma, OEE, production planning, quality control, ISO 9001, root cause analysis, 5S, kaizen, preventive maintenance, shop floor, EHS compliance, bill of materials, CAPA |
| Marketing | campaigns, brand, digital marketing, SEO, content, analytics, lead generation, social media |

Sectors not listed here score B7 as "not applicable" until a list is added (see section 6).

---

## 6. When nothing matches

Rule: an unmatched item is never silently scored as zero. It is either left out of the score
(not applicable) or flagged to the user and counted for our review.

| Situation | What happens | Shown to user |
|---|---|---|
| Job title is not on any ladder (B5) | Check not applicable; points removed from the total | "We couldn't match the job title, so this check was not scored." |
| CV title is not on any ladder (B5) | Check not applicable; the unmatched title is counted for review | "We couldn't match your title, so this check was not scored." |
| Job spec's sector has no list (B7) | Check not applicable | "No sector list for this job yet, so this check was not scored." |
| Skill has no alias row (B1, B2) | Exact match only (after lower-casing); no alias needed for a plain match | Nothing extra |
| Action verb not on the list (A6) | Bullet is not counted as strong, and the first word is counted for review | Nothing extra; the list grows from counts |
| Years or management not in job spec (B4, B6) | Check not applicable | "The job spec didn't ask for this, so it was not scored." |

Why these choices: a zero for something we don't recognise would punish the candidate for our gap,
and would make results look worse for less common job families. Counting unmatched items shows us
which lists need to grow.

---

## Questions for you

1. Are the manufacturing families and terms right, or do you want more (e.g. automotive,
   pharma, FMCG)?
2. Confirm the fallback rules in section 6, in particular "not applicable" for unmatched titles.
3. Is the alias list short enough for now?
