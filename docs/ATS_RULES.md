# ATS score: fixed lists (DRAFT for review)

Status: approved 2026-10-28. Not used by the app yet. The framework is in the
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
| GMP | Good Manufacturing Practice |
| FMEA | failure mode and effects analysis |
| PPAP | production part approval process |
| IATF 16949 | IATF16949 |
| USFDA | US FDA, FDA |
| General trade | GT |
| Modern trade | MT |

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
| Automotive engineering | Graduate engineer → Design engineer → Senior engineer → Chief engineer / Engineering manager |
| Automotive aftersales | Service advisor → Service manager → Aftersales manager → Head of aftersales |
| Pharma quality | QC analyst → QA officer → QA manager → Head of quality |
| Pharma regulatory | Regulatory affairs associate → Regulatory affairs manager → Head of regulatory affairs |
| Pharma production | Production officer → Production executive → Production manager → Plant head |
| FMCG sales | Sales executive → Area sales manager → Regional sales manager → National sales head |
| FMCG brand and marketing | Brand executive → Assistant brand manager → Brand manager → Senior brand manager → Marketing director |
| FMCG supply chain | Supply chain executive → Demand planner → Supply chain manager → Head of supply chain |

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
| Automotive | APQP, PPAP, FMEA, IATF 16949, OEM, tier-1 supplier, homologation, vehicle validation, powertrain, lean manufacturing |
| Pharma | GMP, cGMP, GLP, process validation, regulatory submissions, CDSCO, USFDA, pharmacovigilance, batch records, deviation management, stability studies |
| FMCG | route to market, distribution, general trade, modern trade, trade marketing, shelf availability, category management, brand equity, demand planning, retail execution |
| Marketing | campaigns, brand, digital marketing, SEO, content, analytics, lead generation, social media |

Sectors not listed here score B7 as "not applicable" until a list is added (see section 6).

---

## 6. When nothing matches

Rule: an unmatched item is never scored as zero. It is left out of the score (not applicable),
and the user is not told. The item is counted for our review (section 7), so the lists can grow.

| Situation | Scoring | Recorded for review |
|---|---|---|
| Job title not on any ladder (B5) | Check left out; points removed from the total | The job title |
| CV title not on any ladder (B5) | Check left out | The CV title |
| Job spec's sector has no term list (B7) | Check left out | The sector name |
| Skill has no alias (B1, B2) | Exact match only | The skill term |
| Action verb not on the list (A6) | Bullet not counted as strong | The verb |
| Job spec doesn't ask for years or management (B4, B6) | Check left out | "years" or "management" |

Trade-off to note: a user can't see why a check is missing from their score. We accept this because
showing it would ask them to fix our gap, not theirs.

---

## 7. Monitoring unmatched items and expanding the lists

**What is recorded.** Each unmatched item is saved as one row: the item (normalised: lower case,
spaces collapsed, at most 60 characters), its kind (title, sector, skill, verb or requirement), and a
count and first and last seen dates. **No user id, no CV text, no email or phone.** Rows containing
digits, "@" or more than 4 words are dropped, so names and contact details are never stored.

**How often.** Once a week, we review the top unmatched items by count, once an item has been seen
at least 5 times. Items seen fewer times are kept but ignored.

**What we do with each item:**
1. **Same as an existing skill or title:** add an alias row (section 3) or a title ladder entry
   (section 4). Example: "reactjs" → React.
2. **A new skill, sector term or family:** add it to the list, with a test that it matches.
3. **Noise or not a skill:** mark it ignored, so it stops appearing in the review.

**Rules:**
- Aliases are added by a person, never automatically. A wrong alias changes scores for everyone
  (for example, "R" could be the language or a letter).
- Each change has a test: the new alias matches, and no existing alias now matches a different skill.
- The reviewer sees near-matches to speed up review: for example, "reactjs" is shown next to
  "react" because the spelling is close.
- Changes are recorded in this file, with the date and the item.

---

## Decisions (2026-10-28)

- Families and sectors: automotive, pharma and FMCG added; the lists are approved as drafted.
- Unmatched items: not scored, not shown to the user, recorded for review (section 7).
- Unmatched-item storage: the item text is stored, with kind, count and dates, and no user link.
- Review threshold: an item is reviewed once it has been seen at least 5 times.
- Aliases: alias list is approved for now; new aliases only through review.
