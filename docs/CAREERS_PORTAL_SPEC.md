# Phase 1: Careers Application Portal — New York City

## Authoritative Specification (Build-Ready)

**Version:** 1.0  
**Status:** Approved for development  
**Portal URL:** `https://us.career.houseofspells.com`  
**Scope:** Application intake through offer letter acceptance/decline. **No onboarding.**  
**Branch:** `feature/careers-portal`

---

## Table of Contents

1. [Operating Context](#1-operating-context)
2. [Architecture Overview](#2-architecture-overview)
3. [NYC Legal Compliance Framework](#3-nyc-legal-compliance-framework)
4. [Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
5. [Job Posting Workflow](#5-job-posting-workflow)
6. [Candidate Portal](#6-candidate-portal)
7. [Consolidated User Flow: Online + Walk-In](#7-consolidated-user-flow-online--walk-in)
8. [Application Form Specification](#8-application-form-specification)
9. [Interview Slot Configuration](#9-interview-slot-configuration)
10. [Single Interviewer Scenario](#10-single-interviewer-scenario)
11. [Interviewer Briefing & Scorecard](#11-interviewer-briefing--scorecard)
12. [Offer Letter Generation](#12-offer-letter-generation)
13. [Rejection Workflow](#13-rejection-workflow)
14. [Talent Pool](#14-talent-pool)
15. [Multi-Position Applications](#15-multi-position-applications)
16. [Walk-In Candidate Management](#16-walk-in-candidate-management)
17. [Candidate Rejection & Data Retention](#17-candidate-rejection--data-retention)
18. [Communication Templates](#18-communication-templates)
19. [Audit Trail](#19-audit-trail)
20. [Security](#20-security)
21. [Multi-Location Architecture](#21-multi-location-architecture)
22. [SEO & Job Discovery](#22-seo--job-discovery)
23. [System Modules](#23-system-modules)
24. [Out of Scope (Phase 1)](#24-out-of-scope-phase-1)

---

## 1. Operating Context

| Parameter | Value |
|-----------|-------|
| Distinct job titles | 9–12 (e.g., Sales Associate, Store Manager) |
| Live postings at any time | 5–15 |
| Expected application volume | 50–200/month (spikes during pre-opening/seasonal) |
| Employment types | W-2 only (full-time, part-time, seasonal). No freelance/contract. |
| Primary location (Phase 1) | NYC — Times Square |
| Future expansion | Multi-location via `us.career.*`, `uk.career.*` subdomain pattern |

**Scope boundary:** Candidates apply → screened → interviewed → offered → accept/decline. Background check processing, I-9, pre-boarding, and employee onboarding are **out of scope**.

---

## 2. Architecture Overview

Careers is a **separate service** within the HOS monorepo:

| Component | Path | Purpose |
|-----------|------|---------|
| Careers API | `services/careers-api/` | NestJS backend, separate Prisma schema |
| Careers Web | `apps/careers-web/` | Next.js 14 — public careers site + candidate portal + HR back-office |
| Database | Separate PostgreSQL (`hos_careers`) | Isolated PII/EEOC boundary |
| Redis | Shared instance, prefix `careers:` | BullMQ jobs, caching |
| Storage | S3/MinIO, prefix `careers/` | Resumes, offer PDFs |

**Cross-service:** Minimal. Optional read-only link to HOS Store data for location reference. No shared candidate/customer identity with e-commerce.

---

## 3. NYC Legal Compliance Framework

Every user flow must satisfy these requirements. Legal counsel must review before development begins.

| Law / Regulation | Requirement | System Design Impact |
|------------------|-------------|----------------------|
| NYC Local Law 144 (AEDT) | Independent bias audit (annual), 10-day candidate notice, opt-out path, data access fulfilment | Scoring module requires published audit summary, mandatory consent screen, opt-out to manual review, data request workflow. **AI scoring cannot launch until audit complete.** |
| NYC Local Law 32 (Pay Transparency) | Good-faith salary range (min and max) on all NYC postings | System blocks publication without salary range. Flag if max > 2× min. |
| NYC Fair Chance Act | No criminal history until after conditional offer | Zero criminal history fields on application. Background check post-offer only (handled outside system in Phase 1). |
| NYC Human Rights Law (NYCHRL) | No discrimination on protected classes | Application excludes all protected-class data. AI scoring audited for disparate impact. |
| NYC Salary History Ban (Local Law 67) | Cannot ask salary history | No salary history fields. Block custom fields matching prohibited terms. |
| ADA | WCAG 2.1 AA; reasonable accommodations | WCAG-compliant portal. Accommodation field on form. Scheduling offers accommodations. |
| FCRA | Written consent for background checks; adverse action notices | Consent at offer stage only (outside system Phase 1). |
| NY SHIELD Act | Data security safeguards for NY residents | PII encrypted at rest (AES-256) and in transit (TLS 1.3). Breach notification workflow. |
| EEOC | Voluntary self-ID collected separately | Separate EEOC form; isolated table; never in briefing packs. |
| NYC ESSTA | ESSTA disclosure during hiring | Offer letter template includes ESSTA notice. |
| NY Equal Pay Act | No pay disparity by protected class | System flags proposed offer salary that differs significantly from existing employee pay band for same role. |

### 3.1 AEDT 10-Day Notice (Resolved)

- **Default path:** Application submitted → status `PENDING_AEDT_WINDOW` → AEDT scoring runs after 10 business days.
- **Expedited path:** Candidate receives full AEDT notice on consent screen and may **consent to expedited processing** (notice is given; candidate chooses to proceed immediately). **Requires legal counsel sign-off before launch.**
- **Opt-out path:** Candidate requests manual review. HR reviews within 5 business days (SLA enforced — see §7.3).
- Consent screen text must state: *"You have been notified that an Automated Employment Decision Tool (AEDT) will be used. You may consent to expedited processing or wait the full 10 business days, or request alternative manual review."*

### 3.2 AEDT Data Access Requests (Resolved)

- Candidate requests AEDT data through candidate portal.
- HR Admin reviews export before release.
- Fulfilled within **5 business days**.
- Export includes: input data, scoring dimensions, weights, final score, classification.
- Request logged in audit trail.

### 3.3 Compliance Validation Engine (Resolved)

Before publication, system auto-checks:

1. **Salary range populated** (Local Law 32 gate — hard block)
2. **Salary range reasonableness** — flag if max > 2× min
3. **Prohibited language keyword scan** — maintainable keyword list (e.g., "young", "energetic", "digital native", "recent graduate", "he/she")
4. **Required statements present** — EEO, ADA accommodation, AEDT disclosure (from template, not free-text)
5. **Prohibited custom fields** — block labels matching prohibited terms

---

## 4. Role-Based Access Control (RBAC)

RBAC enforced at three levels: UI (buttons hidden), API (requests rejected), Database (row-level security). All permission checks logged in audit trail.

### 4.1 Role Definitions

| Role | Mapped To | Description |
|------|-----------|-------------|
| Super Admin | System Admin / CTO | Full platform configuration. RBAC, integrations, AEDT settings, data security. **No standard hiring authority.** Emergency approval override when HR Director unavailable. |
| HR Director | Head of HR — US / CHRO | Full HR operational access. Approves postings, offers, AEDT settings, compliance reporting. |
| HR Administrator | HR team member (US) | Day-to-day ops: creates postings, reviews applications, manages scheduling, generates offers. |
| Hiring Manager | Department Head | Submits requisitions; views own-dept candidates; briefing packs; scorecards; recommends hire. |
| Interviewer | Panel member | Views briefing packs (full access per matrix); submits scorecards; views own schedule. |
| Finance Approver | CFO / Finance Director | Approves compensation when salary exceeds posted range midpoint. No individual candidate data access. |
| Legal / Compliance | Legal counsel | Compliance reports, EEOC aggregate, AEDT audit. No individual application access. |

**Candidate auth:** Separate authentication system (email + password, optional TOTP MFA). Not part of back-office RBAC. Hardcoded "own data only" permissions.

### 4.2 Permission Matrix (Corrected)

| Action | Super Admin | HR Director | HR Admin | Hiring Mgr | Interviewer | Finance | Legal |
|--------|:-----------:|:-----------:|:--------:|:----------:|:-----------:|:-------:|:-----:|
| Create Job Requisition | ✖ | ✔ | ✔ | ✔ Own Dept | ✖ | ✖ | ✖ |
| Approve Job Posting | ▲ Emergency | ▲ Approve | ✖ | ✖ | ✖ | ✖ | ✖ |
| Publish / Unpublish Job | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Configure Interview Slots | ✔ | ✔ | ✔ | ○ View | ✖ | ✖ | ✖ |
| View All Applications | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| View Dept Applications | ✔ | ✔ | ✔ | ✔ Own | ✖ | ✖ | ✖ |
| View Candidate Briefing | ✔ | ✔ | ✔ | ✔ Own | ✔ Full | ✖ | ✖ |
| Override AI Score | ✖ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Submit Scorecard | ✖ | ✔ | ✔ | ✔ Own | ✔ | ✖ | ✖ |
| View EEOC Aggregate | ✖ | ○ View | ✖ | ✖ | ✖ | ✖ | ○ View |
| Initiate Offer | ✖ | ✔ | ✔ | ✔ Own | ✖ | ✖ | ✖ |
| Approve Offer (HR) | ▲ Emergency | ▲ Approve | ✖ | ✖ | ✖ | ✖ | ✖ |
| Approve Compensation | ✖ | ✖ | ✖ | ✖ | ✖ | ▲ Final | ✖ |
| Configure RBAC | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| AEDT Settings & Audit | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ○ View |
| Compliance Reports | ○ View | ✔ | ○ View | ✖ | ✖ | ○ View | ✔ |
| Same-Day Interview Mode | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Manage Talent Pool | ✖ | ✔ | ✔ | ○ View | ✖ | ✖ | ✖ |
| View Audit Trail | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✔ |

▲ = Approval authority (Super Admin: emergency only, logged prominently)

### 4.3 Approval Delegation (Resolved)

When HR Director is unavailable, **Super Admin may approve postings and offers** as emergency override. Every override logged in audit trail with reason.

---

## 5. Job Posting Workflow

**Reordered workflow (Resolved):**

```
1. Requisition
   Hiring Manager creates: Department, Job Title, Employment Type,
   Number of Openings, Justification, Start Date, Budget Code.
   New positions require HR Director approval.
   (Finance approval at requisition stage: NOT required)

2. Job Posting Creation
   HR Admin builds posting from template or scratch.
   Candidate-facing: title, department, salary range, description,
   qualifications, benefits.
   Internal: priority, grade, hiring manager, AEDT profile, source channels.

3. Compliance Validation
   Auto-checks per §3.3. Blocked until all pass.

4. Approval
   HR Director reviews: description, salary range, compliance results,
   AEDT weights. Approve / Request Edits / Reject.

5. Interview Slot Configuration
   HR configures scheduling per round (see §9).
   Only after approval — avoids wasted config on rejected postings.

6. Publication
   Live on us.career.houseofspells.com;
   distributed to job boards (Indeed, LinkedIn, Glassdoor) via API;
   Talent Pool members notified; application clock starts.

7. Closure
   Position filled (linked to hired candidate), Cancelled (reason logged),
   or On Hold (re-publishable within 90 days).
```

### 5.1 Posting Templates (Resolved)

- HR Admin can save any posting as a reusable template.
- Template includes: title, department, description, qualifications, benefits, compliance statements, AEDT profile, interview round structure.
- Select template → adjust salary, start date, openings, hiring manager → save as new posting.

### 5.2 Edits After Publication (Resolved)

- **Material changes blocked:** salary range, qualifications, employment type cannot be changed once published.
- **Cosmetic edits allowed:** typos, description clarifications.
- To change material terms: close posting and create new one.

### 5.3 Position On Hold (Resolved)

When position goes On Hold:
- All pipeline activity **paused**.
- Active candidates **notified** that position is temporarily on hold; application preserved.
- In-progress interviews paused; scheduled slots released.
- When re-published within 90 days: candidates resume from last status.
- If cancelled after hold: candidates notified; offered Talent Pool opt-in.

---

## 6. Candidate Portal

**URL:** `https://us.career.houseofspells.com` (authenticated area under `/portal/*`)

**Auth:** Separate from back-office. Email + password registration after first application. Optional TOTP MFA.

### 6.1 Phase 1 Portal Features (Resolved)

| Page | Features |
|------|----------|
| **Dashboard** | Active applications with status per position; status timeline (Applied → Screening → Interview → Decision → Offer); upcoming interviews; action items (select slot, respond to offer) |
| **Interviews** | View upcoming interviews (date, time, location, interviewer); select slot when pending; request reschedule (max 1 per round); past interview history |
| **Offers** | View offer letter (PDF); accept or decline; upload signed PDF (manual signing — no e-signature integration Phase 1) |
| **Withdraw** | Withdraw application per position |

**Not in Phase 1 portal:** Profile editing, communication inbox, EEOC update, data export/deletion (deletion request added — see §17.3), counter-offer submission (negotiation offline).

### 6.2 Data Deletion Request (Resolved)

- "Delete My Data" in portal (SHIELD Act).
- Identity verified via email confirmation link.
- Processed within 30 days.
- Blocked if active pending offer.

---

## 7. Consolidated User Flow: Online + Walk-In

### 7.1 Entry & Discovery

| Channel | Flow |
|---------|------|
| **Online** | Candidate clicks "Join Our Universe" on houseofspells.com or arrives via job board → `us.career.houseofspells.com` |
| **Walk-In** | Staff provides static QR code → same careers page. Tagged `source=walk-in&location=times-square` |

Both channels merge at careers landing page. Walk-in applications tagged "Walk-In (Times Square)" for analytics.

### 7.2 Application Flow

```
2. Careers Landing Page
   Filterable listing: Job Title, Department, Employment Type,
   Salary Range, Location, "View & Apply".
   Positions already applied show "✔ Applied" badge.
   Max 3 simultaneous active applications per candidate.

3. Position Detail
   Full description, responsibilities, qualifications, salary range,
   benefits, reporting line. ADA + EEO statements. "Apply Now".
   Related Positions section. SEO URL + Google Jobs JSON-LD.

4. AEDT Notice & Consent (mandatory, cannot bypass)
   Option A: Consent to AEDT + optional expedited processing
   Option B: Request manual review

5. Application Form (4 sections — see §8)
   Mobile-optimised. NO auto-save. Progress indicator.
   Review-before-submit summary page.

6. EEOC Self-Identification (separate page)
   Voluntary. Confidential. Isolated database.

7. Confirmation
   Reference number. Timeline email.
   Portal registration link for returning candidates.
```

### 7.3 Screening & Decision

```
8. AI Screening / Manual Review
   Option A (AEDT): Skills 30%, Experience 25%, Education 15%,
   Competency 20%, Availability 10%.
   Option B (Manual): HR review within 5 business days.
   SLA: Day 3 alert HR Admin; Day 5 escalate HR Director;
   Day 7 flagged SLA Breach.

9. Classification
   85–100: Auto-shortlisted
   65–84: HR review queue
   40–64: Below-threshold flag
   0–39: Archived (never auto-rejected)
   HR can override any classification.

10. Interview Scheduling
    Candidate selects from pre-configured slots.
    Accommodation prompt. Calendar invite sent.
    No automated slot-selection reminders — HR manages non-responsive candidates.

11. Multi-Round Progression
    R1 Screen → R2 Competency → R3 Panel (L4+) → Final Director (L2+).
    Scorecard per round. Advance/Hold/Decline triggers next action.

12. Offer
    HR configures offer. Approval routing per §12.
    NYC-compliant template. Delivered via portal + email PDF.

13. Response
    Accept: upload signed PDF.
    Counter: handled offline (phone/email); HR updates offer in system.
    Decline: structured reason captured.
    Background check, I-9: outside system Phase 1.
```

---

## 8. Application Form Specification

### 8.1 Section 1: Personal Information

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| First Name | Text | ✔ | Max 50 chars |
| Last Name | Text | ✔ | Max 50 chars |
| Preferred Name | Text | | Used in communications |
| Email | Email | ✔ | Portal access; all communications |
| Phone | Tel | ✔ | US default; international accepted. Store E.164. |
| Preferred Contact | Radio | ✔ | Email / Phone / No Preference |

### 8.2 Section 2: Position & Availability

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Position Applied For | Read-only | ✔ | Auto-populated |
| US Work Authorisation | Radio Yes/No | ✔ | If No: flag to HR, not auto-reject |
| Visa Sponsorship Required | Radio Yes/No | ✔ | Informational; no scoring impact |
| Earliest Start Date | Date picker | ✔ | No minimum date restriction |
| Preferred Schedule | Checkboxes | ✔ | FT / PT / Flexible / Weekends / Evenings / Holidays |

### 8.3 Section 3: Resume & Materials

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Resume Upload | File PDF/DOCX/image 5MB | ✔ | Camera capture for walk-ins. Malware scanned before storage. **No email alternative.** |
| Cover Letter | File or text | | Not scored by AEDT |
| LinkedIn URL | URL | | Shown in briefing pack |
| Portfolio URL | URL | | Relevant for MKT, TECH, Creative |

### 8.4 Section 4: Source & Accommodations

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Source | Dropdown | ✔ | HOS Website / LinkedIn / Indeed / Glassdoor / Referral / Social Media / Walk-In / Job Fair / Other |
| Referral Name | Text | Conditional | If Source = Referral |
| Accommodation Needs | Text area | | ADA. Any entry → immediate HR flag |
| Anything Else | Text area | | Max 500 chars; not scored |

### 8.5 Prohibited Fields

| Prohibited Field | Legal Basis |
|------------------|-------------|
| Date of Birth / Age | NYCHRL; ADEA |
| Gender / Sex | NYCHRL; Title VII |
| Race / Ethnicity | NYCHRL; Title VII |
| Marital / Caregiver Status | NYCHRL |
| Disability Status | ADA; NYCHRL |
| Salary History | NYC Local Law 67 |
| Criminal History | NYC Fair Chance Act |
| Credit History | NYC Local Law 37 |
| Photograph | NYCHRL |
| SSN | NY SHIELD Act |
| Citizenship (beyond work auth) | IRCA |
| Unemployment Status | NYCHRL |
| Height / Weight | NYCHRL (2023) |

### 8.6 Form UX (Resolved)

- Progress indicator (Section 1 of 4)
- Inline validation with WCAG-compliant error messages
- Review-before-submit summary page
- Honeypot field for bot protection
- **No auto-save** — if candidate leaves, they start over

---

## 9. Interview Slot Configuration

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| Slot Duration | Dropdown | 30 min (R1) / 60 min (R2+) | 15/20/30/45/60/90 min; custom 5-min increments |
| Buffer | Dropdown | 15 min | 0/5/10/15/20/30 min |
| Available Days | Checkboxes | Mon–Fri | Any Mon–Sun |
| Time Window Start | Time picker | 1:00 PM ET | 15-min increments |
| Time Window End | Time picker | 5:00 PM ET | Must allow ≥1 full slot |
| Max Slots/Day | Number | 4 | Prevents overload |
| Assigned Interviewer(s) | User selector | Per round | Calendar sync checks conflicts |
| Slot Generation Period | Dropdown | Rolling 10 business days | 5/10/15/20 |
| Auto-Generate from Calendar | Toggle | On | Google/Outlook sync |

### 9.1 Blackout Dates (Resolved)

- HR can manually add blackout dates.
- US federal + NYC holidays pre-populated.
- Global and per-interviewer blackout support.

### 9.2 Rescheduling (Resolved)

| Scenario | Handling |
|----------|----------|
| Candidate reschedule | Max **1** per interview round via portal |
| Interviewer reschedule | **HR Admin coordinates** manually with candidate |
| Candidate no-show | Interviewer marks No-Show → one reschedule opportunity → second no-show = auto-archive |
| Interviewer no-show | **HR handles manually** — contacts candidate to apologize and reschedule |

### 9.3 Video (Resolved)

**No video integration Phase 1.** All interviews in-person at Times Square. Remote second opinions handled outside the system.

---

## 10. Single Interviewer Scenario

**Activation:** Manual toggle by HR Director only.

When activated, adapted workflows per original spec (§19.1–19.5) apply:
- Structured Assessment Tasks by role type
- Bias Mitigation Protocols (standardised questions, anchored rubrics, written justification min 100 chars, cooling period after 3rd interview/day)
- Contingency backup chain (President USA Ops → Remote interviewer → External recruiter → System hold)
- Scheduling adjustments (max 4 interviews/day across all positions, max 15/week, 20-min buffer minimum, 2 business day R1→R2 gap)

**Hard rule:** L3+ hires require Remote Second-Opinion Interview. System blocks offer generation without second evaluator scorecard.

---

## 11. Interviewer Briefing & Scorecard

### 11.1 Briefing Pack Contents

| Section | Visibility |
|---------|------------|
| Candidate Summary (name, position, date, stage, source) | All interviewers |
| AI Compatibility Score + dimension breakdown | All (if consented); "Manual review" note if opted out |
| Resume / CV | All |
| Cover Letter, LinkedIn, Portfolio | All |
| Previous Round Scorecards | From R2 onwards |
| Accommodation Requirements | All + HR |
| Interview Guide (static role-based questions) | All interviewers |

**EXCLUDED:** EEOC data never in briefing pack. Salary history never included. Enforced at database query level.

### 11.2 Interview Guide (Resolved)

**Static, role-based question banks** — same questions for all candidates applying to the same position. **Not AI-generated.** Avoids AEDT classification for interview guides.

### 11.3 Scorecard Fields

| Field | Type | Required |
|-------|------|:--------:|
| Overall Recommendation | Advance / Hold / Decline | ✔ |
| Skills & Technical Competence | 1–5 with anchors | ✔ |
| Communication & Presence | 1–5 with anchors | ✔ |
| Cultural Fit & Fandom Enthusiasm | 1–5 with anchors | ✔ |
| Problem-Solving & Adaptability | 1–5 with anchors | ✔ |
| Customer Service Orientation | 1–5 | Conditional (Sales/Ops/CS) |
| Leadership Potential | 1–5 | Conditional (L4+) |
| Strengths Observed | Free text min 50 chars | ✔ |
| Areas of Concern | Free text min 50 chars | ✔ |
| Would you want this person on your team? | Yes / No / Unsure | ✔ |

**Behavioural anchors on ALL scorecards (Resolved):**
- 1 = Did not demonstrate; concerning gaps
- 3 = Meets expectations; adequate with minor gaps
- 5 = Exceptional; exceeded with specific examples

### 11.4 Scorecard Deadline (Resolved)

- Due within **24 hours** of interview.
- Reminder at 12 hours if not submitted.
- Escalation to HR Admin at 24 hours.
- **Overdue scorecards block next round scheduling** for that candidate.

---

## 12. Offer Letter Generation

### 12.1 Mandatory NYC Contents

Job Title & Description, Compensation (salary/hourly, frequency, FLSA status), At-Will Statement, Benefits (health, 401(k), PTO, ESSTA), NYC ESSTA Notice, NY Wage Theft Prevention Act Notice, Start Date & Schedule, Reporting Line, Background Check Consent reference (FCRA), Offer Expiration (5–7 business days), Contingencies (I-9, background check, references).

### 12.2 Approval Routing (Resolved)

```
Hiring Manager recommends
  → HR Admin generates offer
  → HR Director approves
  → IF salary > posted range midpoint: Finance Approver must approve compensation
```

Super Admin may approve in emergency (logged).

### 12.3 Offer Statuses (Resolved)

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SENT` → `ACCEPTED` | `DECLINED` | `EXPIRED` (manual flag only)

- **No conditional/final distinction** in system Phase 1.
- **Negotiation:** Offline. HR updates offer with final agreed terms.
- **Expiration:** Dashboard flags overdue offers. **No auto-expiration.** HR decides manually.
- **Signing:** Manual PDF. Candidate downloads, signs, scans, uploads via portal. E-signature integration deferred.

### 12.4 Pay Equity Flag (Resolved)

When HR enters offer salary, system compares against stored pay band for job title. Flags outlier (>15% below or above band median) for HR review before approval.

---

## 13. Rejection Workflow

| Rule | Detail |
|------|--------|
| Trigger | **Always manual** — HR Admin or Hiring Manager clicks Decline. Never automatic. |
| Template | **One generic** rejection email for all scenarios |
| Cooling period | **24 hours** between decision and email send (reversible) |
| Talent Pool | **Always included** — rejection email offers Talent Pool opt-in |
| Re-application | Immediate for different positions; 6 months for same job title |

---

## 14. Talent Pool

### 14.1 Registration Form

| Field | Required |
|-------|:--------:|
| First Name / Last Name | ✔ |
| Email | ✔ |
| Phone | |
| Departments of Interest (all 10) | ✔ |
| Employment Type Preference | ✔ |
| Resume Upload | |
| LinkedIn URL | |
| Source | ✔ |
| Brief Introduction (300 chars) | |
| **Consent checkbox** | ✔ — "I consent to HOS storing my information for up to 12 months..." |

### 14.2 Matching & Notification

When new position published: match by department + employment type → automated email notification.

### 14.3 Lifecycle (Resolved)

| Event | Action |
|-------|--------|
| Unsubscribe | Link in every email + portal "Remove me" if account exists. Data deleted within 30 days. |
| Month 11 | Renewal email: "Profile removed in 30 days. Click to renew." |
| Month 12 (no renewal) | Data deleted. Confirmation email sent. |
| Applies for position | Converts to active applicant; records merge |

---

## 15. Multi-Position Applications

- One candidate profile (shared name, contact, resume).
- Separate application records per position; independent AEDT consent and scoring.
- **Max 3 simultaneous active applications.**
- Multi-Offer Alert: HR Director notified if candidate reaches offer stage for multiple positions.

### 15.1 Application Transfer (Resolved)

- HR Admin can transfer application to different position.
- Candidate notified; must consent via email.
- New AEDT consent required.
- Original application retained; transfer creates linked application.

---

## 16. Walk-In Candidate Management

| Scenario | Handling |
|----------|----------|
| A: Casual enquiry | Info card or QR code. No data collected. |
| B: Prepared walk-in | QR code → online application on own device. Same AEDT/compliance workflow. |
| C: Follow-up visit | Directed to Candidate Portal. Staff do not access ATS on floor. |

### 16.1 Walk-In Rules

- Not an interview. No evaluation. No scorecard.
- No prohibited questions (even casually).
- No commitments ("you're hired").
- No data collection on floor. No resumes accepted in hand.
- **Accessibility:** If candidate cannot use portal, staff contacts HR for alternative method (case-by-case; no standard assisted application feature Phase 1).

### 16.2 Same-Day Interview Mode

HR activates during high-volume hiring. Walk-in completes online application on-site → optional immediate R1 screen if: mode active, application complete, position Urgent/High Volume, HR interviewer available within 2 hours, candidate opts in. AEDT score added retroactively if unavailable.

### 16.3 QR Code (Resolved)

Static QR code on poster/card → `https://us.career.houseofspells.com?source=walk-in&location=times-square`

---

## 17. Candidate Rejection & Data Retention

| Data Category | Retention | Disposal |
|---------------|-----------|----------|
| Applications (non-hired) | 12 months | Semi-automated: system flags → HR Admin confirms batch deletion monthly. PII anonymized; resume deleted from S3. |
| Applications (hired) | Employment + 7 years | Manual review before deletion |
| EEOC data | 1–4 years | Auto-delete; never linked post-retention |
| Interview scorecards | 12 months (non-hired); employment + 3 years (hired) | Per schedule |
| AEDT scoring data | 12 months or next audit cycle | Retained for audit; deleted after audit + 12 months |
| Single-interviewer hires | 3 years | Extended for EEOC defensibility |
| Audit logs | 7 years | Append-only; immutable |

---

## 18. Communication Templates

**Channel:** Email only (no SMS Phase 1). **Style:** Fully branded HOS HTML templates with plain-text fallback.

| # | Trigger | Template Slug |
|---|---------|---------------|
| 1 | Application submitted | `careers_application_confirmation` |
| 2 | Shortlisted — interview invitation | `careers_interview_invitation` |
| 3 | Interview scheduled | `careers_interview_scheduled` |
| 4 | Interview reminder (24h before) | `careers_interview_reminder` |
| 5 | Advanced to next round | `careers_next_round_invitation` |
| 6 | Offer extended | `careers_offer_letter` |
| 7 | Offer accepted | `careers_offer_accepted` |
| 8 | Application declined | `careers_rejection_generic` |
| 9 | Position on hold | `careers_position_on_hold` |
| 10 | Talent Pool registration | `careers_talent_pool_welcome` |
| 11 | Talent Pool position match | `careers_talent_pool_match` |
| 12 | Talent Pool renewal (month 11) | `careers_talent_pool_renewal` |
| 13 | Application transfer consent request | `careers_transfer_consent` |
| 14 | Data deletion confirmation | `careers_data_deletion_confirmation` |

Each template: subject line, HTML with `{{variables}}`, plain-text fallback, ADA accommodation statement, unsubscribe link (where applicable).

---

## 19. Audit Trail

**Scope:** Key actions only (not view/login events).

**Logged events:** Application status changes, AEDT consent/opt-out, score overrides (with justification), scorecard submissions, job posting lifecycle (create/approve/publish/close), offer lifecycle (generate/approve/send/accept/decline), RBAC changes, data deletion requests/executions, Super Admin emergency approvals, EEOC access attempts.

**Fields:** timestamp, actorUserId, actorRole, IP, action, targetType, targetId, metadata (JSON diff where applicable).

**Retention:** 7 years. Append-only. Cannot be edited or deleted by any role.

**Access:** Super Admin, Legal/Compliance, HR Director.

---

## 20. Security

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | AES-256 |
| Encryption in transit | TLS 1.3 |
| Back-office auth | SSO + MFA |
| Candidate auth | Email + password; optional TOTP MFA |
| Bot protection | Honeypot field on application form |
| Rate limiting | Max 5 applications per email per 24h |
| Resume malware scan | Scan PDF/DOCX before S3 storage |
| PII in logs | Masked — name, email, phone never in server logs |
| Session timeout | 30-min idle; 8-hour max; invalidate on password change |
| Candidate deduplication | Fuzzy match on firstName + lastName + phone; HR reviews manually |
| Data residency | US-based servers |
| Pen testing | Annual + pre-launch |

---

## 21. Multi-Location Architecture

Model from day one (Phase 1 is NYC only):

```typescript
Location {
  id, name, address, city, state, country,
  timezone,           // e.g., "America/New_York"
  jurisdictionCode,   // e.g., "NYC" — drives compliance rules
  storeId?,           // optional link to HOS Store
  isActive
}
```

- All timestamps stored **UTC**, displayed in `location.timezone`.
- Salary stored as `{ amount: Decimal, currency: "USD" }`.
- Compliance rules (AEDT notice, salary gate, prohibited fields, required statements) configured per `jurisdictionCode`.
- Portal subdomain pattern: `us.career.houseofspells.com`, future `uk.career.houseofspells.com`.

---

## 22. SEO & Job Discovery

**Landing page filters:** Department (multi-select), Employment Type (checkboxes), Location.

**Sort:** Newest first (default), Department A-Z.

**URL pattern:** `https://us.career.houseofspells.com/jobs/sales-associate-times-square`

**Deep links:** `?dept=sales&type=full-time` for job board sharing.

**Structured data:** `JobPosting` JSON-LD on each posting detail page.

No full-text search needed at 5–15 postings scale.

---

## 23. System Modules

| Module | Core Functions |
|--------|----------------|
| Recruitment & ATS | Requisition, posting, application tracking, interview scheduling, offer generation |
| AEDT Scoring Engine | Resume parsing, NLP matching, compatibility scoring, bias audit compliance, opt-out routing |
| Calendar Service | Interviewer availability (Google/Outlook), slot generation, conflict prevention, blackout dates |
| Notification Service | Branded transactional emails |
| Document Generation | Offer letter PDF templating |
| Compliance Engine | AEDT audit management, EEOC reporting, data retention, prohibited-field blocking, pay equity flags |
| Analytics | Basic funnel metrics (Phase 1: counts only; dashboards Phase 1.5) |
| Talent Pool | Registration, matching, notification, retention |

---

## 24. Out of Scope (Phase 1)

- Employee onboarding / pre-boarding
- E-signature integration (DocuSign/HelloSign)
- SMS notifications
- Video conferencing integration
- Application auto-save
- Resume "send via email" alternative
- Conditional vs. final offer workflow in system
- Background check / FCRA workflow in system
- Internal mobility / employee job board
- Referral program system (manual tracking only)
- Analytics dashboards (basic counts only)
- Finance approval at requisition stage
- Assisted application / in-store kiosk

---

## Critical Path Reminder

**AEDT Bias Audit must complete before AI scoring goes live.** Development can proceed in parallel. If audit delayed, launch with manual-only review.

**Legal counsel must sign off on:** All flows, forms, AEDT architecture (including expedited consent mechanism), offer template, before development begins.

---

*End of specification.*
