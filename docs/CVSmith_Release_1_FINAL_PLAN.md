# CVSmith Release 1: Final Consolidated Plan

**Status:** READY FOR IMPLEMENTATION  
**Timeline:** 10 weeks (Weeks 1–10)  
**Team:** 4–5 people (Backend, Frontend, ML/LLM, QA, PM)  
**Estimated Cost:** $80K–100K (team) + $5K–10K (infra)

---

## Executive Summary

### What You're Building
A minimal MVP that validates the core loop: candidate uploads CV → edits in live canvas → gets AI suggestions → downloads PDF + exports JSON Resume.

### Key Features (In Scope)
- ✅ Google sign-in + email/password signup (Apple sign-in deferred to a later release)
- ✅ Single-page onboarding (email, password, CV upload)
- ✅ PDF/Word CV upload with background parsing
- ✅ Live canvas editor with auto-save
- ✅ Field-level AI suggestions (Professional Summary, Experience, etc.)
- ✅ Free first suggestion to demonstrate value
- ✅ Privacy toggle (Private/Public, default Public)
- ✅ PDF download + JSON export
- ✅ Pro tier ($9.99/mo) with suggestion quota (50/month)
- ✅ Free tier (1 suggestion/month, then upgrade)

### What's NOT In Release 1
- ❌ LinkedIn import (Release 2)
- ❌ Microsite publishing (Release 3)
- ❌ Role-based CV variants (Release 2)
- ❌ Recruiter search (Release 2)
- ❌ Word download (PDF only)
- ❌ Section/field-level privacy (Release 2)

---

## User Journey (Complete)

```
ONBOARDING (Single Page - ZERO FRICTION)
├─ Email input
├─ Password input
├─ CV upload (PDF/Word, drag-drop)
├─ OR: Google sign-in
└─ "Get Started" → Instant to dashboard (no email verification blocking)

PARSING (Background)
└─ Extract text → Claude parses → JSON Resume created
└─ Optional: Email verification available in Settings (not blocking)

LIVE CANVAS (Immediate)
├─ Personal Info (name, email, phone, location, LinkedIn URL, Portfolio URL) - pre-filled from CV
├─ Professional Summary (💡 Suggestion available)
├─ Work Experience (add/edit/delete jobs) (💡 Suggestion per job)
├─ Education (add/edit/delete degrees)
├─ Skills (add/edit/delete skills)
├─ Certifications (add/edit/delete - name, issuer, issue date)
├─ Auto-save every 2 seconds
└─ Right panel: Live PDF preview

FIELD-LEVEL SUGGESTIONS (Smart Monetization)
├─ 1 FREE suggestion available (first interaction)
├─ Click 💡 icon on any field → See AI improvement
├─ Example fields: Professional Summary, Job Description, Skills
├─ Show current → Suggested with reasoning
├─ Accept/Decline → Applies to canvas
├─ After free suggestion used → Show upgrade prompt
└─ Pro tier: 50 suggestions/month (unlimited field improvements)

CV PREVIEW
└─ Updates in real-time as user edits

PRIVACY CONTROL (Default PUBLIC)
├─ Toggle: 🌍 PUBLIC (default) ↔ 🔒 PRIVATE
├─ Info: "Public makes CV eligible for recruiter search (launching soon)"
└─ JSON Resume marked with privacy flag

DOWNLOAD & EXPORT
├─ Download PDF (single professional template)
├─ Export JSON Resume
└─ Show: "Your CV saved. You can regenerate anytime."

ACCOUNT SETTINGS (No blockers)
├─ Email verification (optional)
├─ Phone (optional)
├─ Billing & upgrade
├─ Data export / delete account
```

---

## Database Schema (Final)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- CVs
CREATE TABLE cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT 'My CV',
  json_resume JSONB NOT NULL,
  privacy ENUM('private', 'public') DEFAULT 'private',
  parsing_status ENUM('pending', 'in_progress', 'complete', 'failed') DEFAULT 'pending',
  parsing_error TEXT,
  raw_upload_path VARCHAR(512),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id) -- One CV per user in Release 1
);

-- Suggestions
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_id UUID NOT NULL REFERENCES cvs(id) ON DELETE CASCADE,
  suggestion_type VARCHAR(50), -- 'structure', 'clarity', 'completeness', 'phrasing'
  original_text TEXT,
  suggested_text TEXT,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Billing
CREATE TABLE billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  tier ENUM('free', 'pro') DEFAULT 'free',
  suggestion_count_this_month INT DEFAULT 0,
  billing_period_start DATE,
  billing_period_end DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50), -- funnel steps; see "Funnel tracking" under Week 5–6
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_cvs_user_id ON cvs(user_id);
CREATE INDEX idx_suggestions_user_id ON suggestions(user_id);
CREATE INDEX idx_suggestions_cv_id ON suggestions(cv_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_created_at ON events(created_at);
```

---

## API Endpoints (Complete)

### Auth
```
POST   /api/auth/signup              → Register email + password
POST   /api/auth/verify              → Verify email token
POST   /api/auth/login               → Login (email + password)
POST   /api/auth/logout              → Logout
POST   /api/auth/password-reset      → Request reset link
PATCH  /api/auth/password-reset/{token} → Reset password
```

### CV Management
```
POST   /api/cv/upload                → Upload PDF/Word
GET    /api/cv                       → Get CV (JSON Resume + metadata)
PATCH  /api/cv                       → Update CV fields
PATCH  /api/cv/privacy               → Toggle privacy (private/public)
GET    /api/cv/download              → Download PDF
GET    /api/cv/export                → Export JSON Resume
DELETE /api/cv                       → Delete CV
```

### Suggestions
```
POST   /api/suggestions              → Request AI suggestions
GET    /api/suggestions              → List suggestions for CV
PATCH  /api/suggestions/{id}         → Accept/reject/edit suggestion
GET    /api/user/suggestion-quota    → Check remaining suggestions
```

### User
```
GET    /api/user                     → Get profile
PATCH  /api/user                     → Update profile
GET    /api/user/events              → Activity log
DELETE /api/user                     → Delete account
```

### Billing (Minimal for R1)
```
POST   /api/billing/checkout         → Initiate Stripe checkout
GET    /api/billing/status           → Check billing status
```

---

## Technology Stack (Final)

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL 14+
- **Cache:** Redis (optional, for session management)
- **Job Queue:** Celery + Redis
- **File Storage:** AWS S3 (or MinIO for local dev)
- **Auth:** JWT (self-hosted)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **PDF Preview:** react-pdf
- **State Management:** React Query / Zustand

### External Services
- **Email:** SendGrid
- **Payment:** Stripe
- **LLM:** Claude API (Anthropic)
- **PDF Generation:** ReportLab (Python)
- **Hosting:** AWS EC2 / ECS or Railway

### DevOps
- **VCS:** GitHub
- **CI/CD:** GitHub Actions
- **Container:** Docker
- **Secrets:** GitHub Secrets / AWS Secrets Manager

---

## Implementation Timeline (Detailed)

### Week 1–2: Foundation & Auth
- [ ] Set up GitHub repo (backend + frontend)
- [ ] Configure GitHub Actions (CI/CD)
- [ ] Set up PostgreSQL, Redis, S3
- [ ] Implement JWT auth system
- [ ] Email/password signup + login endpoints
- [ ] Google OAuth integration
- [ ] Optional email verification (non-blocking, available in Settings)
- [ ] Frontend: Single-page onboarding (email, password, CV upload)
- [ ] Frontend: Google sign-in button
- [ ] Frontend: Login modal for returning users
- [ ] Basic error handling + validation

**Definition of Done:** User can signup/login with email or social, upload CV, proceed to dashboard without blocking verification

---

### Week 3–4: CV Upload & Parsing
- [ ] File upload endpoint (POST /api/cv/upload)
- [ ] Temp file storage (S3 or local)
- [ ] PDF/Word text extraction (PyPDF2, python-docx)
- [ ] CV parsing worker (Claude API to structure CV)
- [ ] cvs table + migrations
- [ ] parsing_status tracking
- [ ] Frontend: CVUpload component (drag-drop, progress)
- [ ] Error handling (unsupported format, parse failure)

**Definition of Done:** User can upload PDF/Word, parsing completes, JSON Resume created

---

### Week 5–6: Live Canvas & Preview
- [x] Dashboard layout (canvas + preview)
- [x] LiveCanvas component (editable sections; five groups, agreed 2026-10-13)
- [x] Auto-save logic (PATCH /api/cv ~2 s after the last change; "Saving… / All changes saved")
- [x] PDF preview rendering (right panel) — live HTML preview in CV order; the real PDF is Week 9
- [x] Merge conflict resolution (parsing + edits): parser writes `json_resume`, saves write `content`;
      parsed parts merge into empty fields only, once (`applied_parts`)
- [x] Session persistence (restore canvas state on load)
- [x] Frontend: Dashboard, LiveCanvas, CVPreview components
- [x] Funnel tracking: events table + migration 0003, five steps recorded, report in `docs/FUNNEL.md`
- [x] A new upload replaces the CV and edits only after the user confirms (agreed 2026-10-13)

**Definition of Done:** User can edit CV in real-time, see live preview, edits auto-save; each
funnel step is recorded and a funnel report shows how many users reach each step

**Funnel tracking (agreed 2026-10-13, option A: our own events table).** Goal: see where users
drop off. One row per step a user reaches, recorded by the backend where possible (the frontend
only for steps the server cannot see):
1. `signup` · 2. `email_verified` · 3. `cv_uploaded` · 4. `parsing_finished` (metadata: complete
   or failed, failed parts) · 5. `first_edit` · 6. `suggestion_requested` · 7. `upgrade_prompt_shown`
   · 8. `upgraded` · 9. `pdf_downloaded`
- Record only the step, time, user id and small metadata (e.g. part names, plan). **Never CV
  content**, names, emails or file names.
- "Once per user" steps (`first_edit`, `email_verified`) are recorded once; the report counts
  distinct users per step.
- Report: one SQL query (distinct users per step, optionally per signup week) in `docs/`, run by
  hand at first; a dashboard can come later.
- Recording must never break or slow the user's action: failures are logged and ignored.
- Steps 6–9 belong to later weeks; add each event when that feature is built.

**Canvas layout (agreed 2026-10-13).** Five fixed groups: Personal details (incl. headline),
Professional details (summary, work, projects), Education (incl. grade/score), Skills &
Certifications (skills as LinkedIn-style tags), Others (languages, awards, volunteering &
leadership, interests, user-named custom sections). New kinds of content go into Others as a
new item type, not a new canvas section. The PDF preview uses the same order.

---

### Week 7–8: Field-Level AI Suggestions
- [x] POST /api/suggestions endpoint (body names the field; contract in `docs/API_CONTRACT.md`)
- [x] Claude API integration (per-field improvement generation, house-style prompt)
- [x] suggestions table + queries (every suggestion stored with its decision)
- [x] Suggestion quota tracking (free: 1 suggestion/month free, Pro: 50/month)
- [x] Track "free suggestion used" per user (counted from the suggestions table, no separate flag)
- [x] Frontend: SuggestionModal component (show current → improved → accept/decline)
- [x] Frontend: 💡 Improve button on the fields that support suggestions
- [x] Frontend: Upgrade prompt after free suggestion used
- [x] Accept/reject/apply suggestion flow
- [x] Track suggestion metrics for analytics (funnel events + accepted/declined in the table)

**Decisions (agreed 2026-10-14):**
- 💡 on the Professional Summary, each Work Experience description and each Project
  description. One click = one suggestion for the whole field.
- Quota per calendar month (UTC), resets on the 1st. A "no change needed" result and a failed
  AI call do not count. Checked before the AI call (402 `QUOTA_EXCEEDED`).
- Upgrade prompt: "You've used your free suggestion for this month. Upgrade to Pro for 50
  suggestions a month ($9.99/month)." with [See Pro plans] → `/pricing` and [Not now].
- `users.plan` is "free" or "pro"; no payments and no admin command yet, so nobody is Pro.
- Model: `claude-sonnet-5-5` (`SUGGESTION_MODEL`). Side-by-side with Opus on 8 fields from the
  test CVs: same facts kept, similar quality; Opus ~2x the cost (~$0.03 vs ~$0.013 per
  suggestion) and slower (4–18 s vs 3–14 s).
- Accepting replaces the field in the canvas; it is auto-saved like typing (counts as an edit).
- After testing (agreed 2026-10-14): small edits come back as "no change" (not counted); a
  summary written as an objective is rewritten as a factual summary from the rest of the CV
  (titles, employers, dates, degrees, skills, certifications; no contact details).

**Definition of Done:** User can click 💡 on any field, see AI improvement, accept/reject, free suggestion converts to upgrade prompt

**Writing rules (house style for suggestions).** Agreed 2026-10-13. These rules apply to
suggestions only, never to parsing: parsing keeps the candidate's own wording so the canvas
matches their CV, and every rewrite is shown to the user to accept or reject.
Source of truth: `.claude/skills/cv-house-style/SKILL.md` (rules, how to apply them, suggestion
format, examples). Change the rules there; the list below is a summary.
- Use concise professional language.
- Prefer active verbs and strong action words.
- Focus on outcomes, ownership, scale and impact.
- Remove vague phrases and unnecessary repetition.
- Avoid first-person pronouns ("Led", not "I led").
- Do not use decorative language unsupported by evidence.
- Preserve accurate job titles and employment dates.
- Use terminology appropriate to the candidate's profession.
- Expand uncommon abbreviations on first use when the meaning is known; otherwise leave them
  as written (no questions to the user).
- Keep sentences concise; split long sentences into multiple bullet points.
- Never add facts that are not in the CV (same rule as parsing).
- Suggestions may also propose re-ordering sections or entries (e.g. projects before work
  for a fresher). The preview follows the canvas order, so an accepted re-order shows there too.

---

### Week 9: Download, Export & Privacy
- [x] PDF rendering — headless Chromium prints the frontend's Classic template (`print.html`),
      not ReportLab: one template for preview and PDF (agreed 2026-10-14)
- [x] ATS-readable template: real text only, single reading order, no text in images, graphics or tables (writing rule agreed 2026-10-13)
- [x] GET /api/cv/download endpoint (free for every plan)
- [x] JSON Resume export (GET /api/cv/export, Pro only; free users see the upgrade prompt)
- [x] Privacy toggle (PATCH /api/cv/privacy)
- [x] Default privacy to PUBLIC (not private)
- [x] Frontend: PrivacyToggle component (🌍 Public / 🔒 Private), saved on click
- [x] Frontend: Download button + file stream (saves pending edits first); Export JSON button
- [x] Update JSON Resume with privacy flag + cvsmith metadata (`meta.cvsmith`)
- [x] Show privacy status badge on dashboard (🌍 Public or 🔒 Private)

**Decisions (agreed 2026-10-14):** PDF download is free for everyone; JSON export is Pro
only. "Public" is a saved flag only in Release 1 (nothing reads it until recruiter search in
Release 2). Funnel events `pdf_downloaded`, `json_exported`.

**Definition of Done:** User can download PDF, export JSON, toggle privacy (default Public), see privacy status

---

### Week 10: Billing & Pro Tier
- [ ] Stripe integration (checkout session)
- [ ] billing table + migrations
- [ ] POST /api/billing/checkout endpoint
- [ ] Webhook handling (payment success/failure)
- [ ] Suggestion quota enforcement (middleware)
- [ ] Frontend: Upgrade button, Pro badge, pricing
- [ ] Email confirmations (receipt, Pro activated)
- [ ] Admin dashboard (basic: user metrics, events)

**Definition of Done:** User can upgrade to Pro, suggestion quota enforced, payment working

---

### Week 11: Testing, QA & Polish
- [ ] Unit tests (auth, CV operations, suggestions)
- [ ] Integration tests (full user flow)
- [ ] E2E tests (Cypress or Playwright)
- [ ] Manual QA (all user flows)
- [ ] Performance testing (file upload, PDF generation)
- [ ] Security audit (JWT, file handling, SQL injection)
- [ ] Bug fixes + edge cases

**Definition of Done:** All tests pass, zero critical bugs, ready for production

---

### Week 12: Deployment & Monitoring
- [ ] Set up production environment (AWS/Railway)
- [ ] Database migrations (production)
- [ ] Environment variables + secrets
- [ ] SSL/TLS certificates
- [ ] Logging + monitoring (DataDog/New Relic)
- [ ] Backups + disaster recovery
- [ ] Deploy backend + frontend
- [ ] Monitor for 48 hours, hotfixes

**Definition of Done:** System live, no critical errors, team trained on monitoring

---

## Success Metrics (Release 1)

### Critical KPIs
| Metric | Target | By End of Week 2 |
|--------|--------|-----------------|
| Signup rate | 100 signups | Collect feedback |
| Upload rate | >60% of signups | Validate UX |
| Parse success rate | >85% | Adjust parsing logic |
| First download rate | >40% | **GO/NO-GO decision** |
| Pro conversion | >10% | **GO/NO-GO decision** |
| Suggestion acceptance | >50% | **GO/NO-GO decision** |

### Secondary Metrics
- Time to first download (target: <10 min)
- Parsing time (target: <60 sec)
- Suggestion request latency (target: <5 sec)
- Churn rate week 2→3 (target: <5%)

### Go/No-Go Decisions

**If >40% download + >10% Pro conversion:**
- ✅ **GO to Release 2** (LinkedIn import, role-based CVs, recruiter search)

**If 20–40% download and 5–10% Pro:**
- ⚠️ **ITERATE** (improve parsing, UX, or pricing)

**If <20% download or <5% Pro:**
- ❌ **PIVOT** (fundamental value prop issue; rethink approach)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Parsing accuracy poor** | Medium | High | Test with 50+ real CVs; set low expectations ("This is a draft"); require manual review |
| **Merge conflicts (parsing + edits)** | Medium | Medium | Timestamp-based resolution; user edits always win if newer |
| **LLM hallucination in suggestions** | Medium | High | Filter suggestions; don't suggest fabricated jobs; watermark as AI |
| **Slow parsing (>60s)** | Low | Medium | Set timeout; allow editing while parsing; show progress |
| **Payment processing fails** | Low | High | Implement idempotency; retry logic; manual verification endpoint |
| **Security: API key exposure** | Low | Critical | Use environment variables; rotate keys monthly; audit logs |
| **Database: Data corruption** | Very Low | Critical | Daily backups; test restore weekly |

---

## Definition of MVP Complete

✅ User can sign up with email  
✅ User can upload PDF or Word CV  
✅ System parses CV in background → JSON Resume  
✅ User can edit CV in live canvas  
✅ User sees live PDF preview  
✅ User can request AI suggestions (Pro tier)  
✅ User can download PDF + export JSON  
✅ User can toggle privacy (Private/Public)  
✅ User can upgrade to Pro tier ($9.99/mo)  
✅ Suggestion quota enforced (1/mo free, 50/mo Pro)  
✅ System logs events + basic analytics  
✅ All tests pass, zero critical bugs  
✅ System deployed to production  

---

## Post-Release 1: Release 2 Roadmap (Preview)

### Release 2 (Weeks 13–22, 10 weeks)
- LinkedIn profile import
- Role-based CV variants (unlimited beyond 2 free)
- Recruiter beta (invite-only)
  - MCP integration
  - Private search endpoint
  - Recruiter tokens (scoped, revocable)
  - **Current-employer shield** (requested 2026-10-13): a recruiter must never find, in
    search results or via the search endpoint, the CV of someone who currently works for
    the recruiter's own organization. Design notes, to be decided when this is built:
    - Depends on: recruiter accounts tied to a verified organization (e.g. verified
      company email domain), and the candidate's current role(s) — the canvas's
      "I currently work here" flag (Release 1) is the data source.
    - Matching org ↔ employer: CV employer names are free text ("Acme", "Acme Ltd",
      a subsidiary), so auto-matching alone is unreliable. Option: let candidates confirm
      or add the companies to hide from, pre-filled from their current roles.
    - Default on for every candidate with a current role (recommended), or opt-in?
    - Limits to state honestly in the UI: the shield covers CVSmith search/discovery only.
      A **public** CV's own link and AI-readable endpoint are reachable by anyone who has the
      URL, and agency recruiters working for the employer are not detectable.
- Section-level privacy controls
- Advanced analytics

### Release 3 (Weeks 23+)
- Microsite publishing ($9.99/mo)
  - Custom domain support
  - SEO optimization
  - Analytics
- AI prompt CV creation
- Field-level privacy
- Recruiter accounts + subscriptions

---

## Team & Responsibilities

### Backend Lead (1 FTE)
- Architect FastAPI app + database
- Implement auth, CV operations, suggestions
- CV parsing worker
- Stripe integration
- API testing

### Frontend Lead (1 FTE)
- React app architecture
- Dashboard, live canvas, components
- PDF preview integration
- Stripe checkout UI
- E2E testing

### ML/LLM Engineer (1 FTE, 0.5 FTE for R1)
- Claude API integration
- CV parsing logic
- Suggestion generation
- Prompt engineering
- Cost optimization

### QA Engineer (1 FTE, 0.5 FTE for R1)
- Test plan + cases
- Manual testing
- Bug reporting
- Performance testing
- Security audit

### Product Manager (1 FTE)
- Requirements + prioritization
- Metrics tracking
- User feedback
- Release coordination
- Roadmap planning

---

## Estimated Costs

### Team (10 weeks)
- Backend Lead: $15K
- Frontend Lead: $15K
- ML/LLM: $8K (0.5 FTE)
- QA: $5K (0.5 FTE)
- PM: $8K (0.5 FTE)
- **Subtotal: $51K**

### Infrastructure
- AWS (EC2, RDS, S3): $2K
- Stripe processing: $300 (payment fees)
- Claude API: $500 (parsing + suggestions)
- SendGrid: $100
- Monitoring/logging: $500
- **Subtotal: $3.4K**

### Tools & Services
- GitHub (free)
- VS Code (free)
- AWS (includes free tier)
- PostgreSQL (free)
- Redis (free)
- **Subtotal: $0K**

### **Total Estimated Cost: $54.4K**

(Higher estimates include senior salaries, benefits, overhead)

---

## Success = Go to Release 2

```
Week 12: Production live
  ↓
Week 13: Monitor, collect feedback
  ↓
Week 14: Analyze metrics
  ↓
Are metrics met?
  ├─ YES (>40% download, >10% Pro) → GO to Release 2
  └─ NO → Iterate or pivot
```

---

## Checklist: Ready to Build

- [x] Feature scope finalized (in/out of scope)
- [x] User journey mapped
- [x] Database schema designed
- [x] API endpoints defined
- [x] Tech stack chosen
- [x] Timeline detailed (by week)
- [x] Risks identified + mitigated
- [x] Success metrics defined
- [x] Team roles assigned
- [x] Cost estimated
- [ ] **GitHub repo created** ← Next step
- [ ] **Local dev environment set up** ← Next step
- [ ] **Folder structure established** ← Next step
- [ ] **First sprint planned** ← Next step

---

## Next Steps

1. **GitHub Setup** (Today)
   - Create repo: cvsmith-app
   - Branch strategy: main, develop, feature branches
   - Folder structure: /backend, /frontend

2. **Local Development** (Today)
   - Clone repo
   - Set up virtual environments (Python + Node)
   - Configure .env files
   - Install dependencies

3. **First Sprint** (Week 1)
   - Assign tasks
   - Stand-up meetings (daily 15 min)
   - Kanban board (GitHub Projects)
   - Kick off backend + frontend in parallel

---

## READY TO IMPLEMENT ✅

