# Careers Portal — Composer 2.5 Build Specification

## Complete Technical Implementation Guide

**Purpose:** Single source of truth for building the Phase 1 Careers Application Portal. Feed this document to Composer 2.5 (or any Cursor agent) to scaffold and implement the service.  
**Functional spec:** See [`CAREERS_PORTAL_SPEC.md`](./CAREERS_PORTAL_SPEC.md) for all business rules and resolved gap decisions.  
**Branch:** `feature/careers-portal`  
**Portal URL:** `https://us.career.houseofspells.com`  
**Do NOT deploy** until UAT complete — this doc includes Railway setup plan only.

---

## Table of Contents

1. [Pre-Build: Codebase Context](#1-pre-build-codebase-context)
2. [Architecture Decision](#2-architecture-decision)
3. [Monorepo Setup](#3-monorepo-setup)
4. [Prisma Schema (Full Data Model)](#4-prisma-schema-full-data-model)
5. [Backend Module Breakdown](#5-backend-module-breakdown)
6. [REST API Specification](#6-rest-api-specification)
7. [Frontend Pages (careers-web)](#7-frontend-pages-careers-web)
8. [Authentication](#8-authentication)
9. [RBAC Implementation](#9-rbac-implementation)
10. [Background Jobs & Cron](#10-background-jobs--cron)
11. [Notification Templates](#11-notification-templates)
12. [File Storage & Malware Scanning](#12-file-storage--malware-scanning)
13. [Compliance Engine](#13-compliance-engine)
14. [AEDT Scoring Engine (Stub for Audit)](#14-aedt-scoring-engine-stub-for-audit)
15. [Implementation Phases (Suggested Order)](#15-implementation-phases-suggested-order)
16. [Railway Deployment Plan](#16-railway-deployment-plan)
17. [Git Branch Strategy](#17-git-branch-strategy)
18. [What NOT to Build (Phase 1)](#18-what-not-to-build-phase-1)
19. [Verification Checklist](#19-verification-checklist)

---

## 1. Pre-Build: Codebase Context

### Existing HOS Stack (reference only — do not modify for Phase 1)

| Layer | Location | Tech |
|-------|----------|------|
| E-commerce API | `services/api/` | NestJS 10, Prisma 6, PostgreSQL, Redis, BullMQ |
| Web storefront | `apps/web/` | Next.js 14 App Router, Tailwind, TanStack Query |
| Shared packages | `packages/*` | shared-types, utils, api-client, theme-system |
| Monorepo | root | pnpm workspaces + Turborepo |

### Patterns to Mirror from Existing API

Copy these conventions from `services/api/`:

- Response envelope: `{ data, message }` as `ApiResponse<T>` from `@hos-marketplace/shared-types`
- Guards: `@Public()`, `@Roles()`, `@Permissions()`, `@CurrentUser()`
- Swagger: `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`
- Notifications: `TemplatesService` slug-based HTML with `{{variables}}` → BullMQ `EMAIL_NOTIFICATION`
- Storage: `StorageService` (S3/MinIO) with signed URLs for PII files
- GDPR-style deletion: anonymize PII, delete files, retain audit logs (see `services/api/src/gdpr/`)
- Event lifecycle: string statuses with explicit transitions (see `services/api/src/events/`)

### Existing Infrastructure to Reuse (shared credentials, separate data)

| Resource | Reuse Strategy |
|----------|----------------|
| Redis | Same `REDIS_URL`, BullMQ queue name prefix `careers:` |
| SMTP | Same nodemailer config, careers-specific from address |
| S3/MinIO | Same bucket, prefix `careers/resumes/`, `careers/offers/` |
| Shared packages | `@hos-marketplace/shared-types`, `@hos-marketplace/utils` |

**Do NOT share:** PostgreSQL database, JWT secrets (use separate `CAREERS_JWT_SECRET`), candidate/back-office user tables.

---

## 2. Architecture Decision

```
HOS-Latest/
├── services/
│   ├── api/                    # Existing e-commerce (unchanged)
│   └── careers-api/            # NEW — NestJS ATS backend
│       ├── prisma/schema.prisma
│       ├── src/
│       └── Dockerfile
├── apps/
│   ├── web/                    # Existing storefront (unchanged)
│   └── careers-web/            # NEW — Next.js careers portal
│       ├── src/app/
│       └── Dockerfile
├── packages/
│   └── careers-types/          # NEW (optional) — shared careers enums/DTOs
```

| Service | Port (local) | Production Domain |
|---------|--------------|-------------------|
| careers-api | 3002 | `careers-api` Railway service (internal + API subdomain TBD) |
| careers-web | 3003 | `us.career.houseofspells.com` |

---

## 3. Monorepo Setup

### 3.1 Root `package.json` workspaces

Add to workspaces array:

```json
"workspaces": [
  "apps/*",
  "packages/*",
  "services/api",
  "services/careers-api"
]
```

### 3.2 Root dev script (optional)

```json
"dev:careers": "turbo run dev --filter=@hos-marketplace/careers-api --filter=@hos-marketplace/careers-web --concurrency=3"
```

### 3.3 New package: `services/careers-api/package.json`

```json
{
  "name": "@hos-marketplace/careers-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "pnpm db:generate && nest build",
    "dev": "nest start --watch",
    "start": "prisma migrate deploy && node dist/main.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  }
}
```

Dependencies: mirror `services/api/package.json` essentials — `@nestjs/*`, `@prisma/client`, `prisma`, `bullmq`, `ioredis`, `nodemailer`, `@aws-sdk/client-s3`, `bcrypt`, `passport-jwt`, `class-validator`, `class-transformer`, `@hos-marketplace/shared-types`, `@hos-marketplace/utils`.

### 3.4 New package: `apps/careers-web/package.json`

```json
{
  "name": "@hos-marketplace/careers-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p 3003",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

Dependencies: `next@14`, `react`, `@tanstack/react-query`, `@hos-marketplace/shared-types`, `@hos-marketplace/theme-system`, `tailwindcss`.

### 3.5 Docker Compose (local dev)

Add to `docker-compose.yml`:

```yaml
  careers-postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: careers_user
      POSTGRES_PASSWORD: careers_password
      POSTGRES_DB: hos_careers
    ports:
      - "5433:5432"
    volumes:
      - careers_postgres_data:/var/lib/postgresql/data

  careers-api:
    build:
      context: .
      dockerfile: services/careers-api/Dockerfile
    ports:
      - "3002:3002"
    environment:
      DATABASE_URL: postgresql://careers_user:careers_password@careers-postgres:5432/hos_careers
      REDIS_URL: redis://redis:6379
      PORT: 3002
      CAREERS_JWT_SECRET: dev-careers-secret
      FRONTEND_URL: http://localhost:3003
    depends_on:
      careers-postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

---

## 4. Prisma Schema (Full Data Model)

File: `services/careers-api/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ───────────────────────────────────────────────

enum BackOfficeRole {
  SUPER_ADMIN
  HR_DIRECTOR
  HR_ADMIN
  HIRING_MANAGER
  INTERVIEWER
  FINANCE_APPROVER
  LEGAL_COMPLIANCE
}

enum RequisitionStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
}

enum PostingStatus {
  DRAFT
  PENDING_COMPLIANCE
  PENDING_APPROVAL
  APPROVED
  PUBLISHED
  ON_HOLD
  FILLED
  CANCELLED
  ARCHIVED
}

enum ApplicationStatus {
  SUBMITTED
  PENDING_AEDT_WINDOW
  AEDT_SCORING
  MANUAL_REVIEW
  SHORTLISTED
  HR_REVIEW
  BELOW_THRESHOLD
  ARCHIVED
  INTERVIEW_SCHEDULING
  INTERVIEWING
  OFFER_PENDING
  OFFER_SENT
  OFFER_ACCEPTED
  OFFER_DECLINED
  WITHDRAWN
  REJECTED
  NON_RESPONSIVE
}

enum AEDTConsentType {
  EXPEDITED
  STANDARD_WAIT
  MANUAL_REVIEW_OPT_OUT
}

enum InterviewRound {
  R1_SCREEN
  R2_COMPETENCY
  R3_PANEL
  FINAL_DIRECTOR
}

enum InterviewStatus {
  SCHEDULED
  COMPLETED
  NO_SHOW
  CANCELLED
  RESCHEDULED
}

enum ScorecardRecommendation {
  ADVANCE
  HOLD
  DECLINE
}

enum OfferStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SENT
  ACCEPTED
  DECLINED
  EXPIRED_FLAGGED
}

enum AuditAction {
  APPLICATION_STATUS_CHANGED
  AEDT_CONSENT_GIVEN
  AEDT_SCORE_OVERRIDDEN
  SCORECARD_SUBMITTED
  POSTING_CREATED
  POSTING_APPROVED
  POSTING_PUBLISHED
  POSTING_CLOSED
  OFFER_GENERATED
  OFFER_APPROVED
  OFFER_SENT
  OFFER_ACCEPTED
  OFFER_DECLINED
  RBAC_CHANGED
  DATA_DELETION_REQUESTED
  DATA_DELETION_EXECUTED
  EMERGENCY_APPROVAL
  EEOC_ACCESS_ATTEMPT
}

// ─── LOCATION & ORG ──────────────────────────────────────

model Location {
  id               String   @id @default(uuid())
  name             String
  address          String
  city             String
  state            String
  country          String   @default("US")
  timezone         String   @default("America/New_York")
  jurisdictionCode String   @default("NYC")
  storeId          String?
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  jobPostings JobPosting[]
  blackoutDates BlackoutDate[]
}

model Department {
  id        String   @id @default(uuid())
  name      String   @unique
  slug      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  jobPostings  JobPosting[]
  requisitions JobRequisition[]
  payBands     PayBand[]
}

model PayBand {
  id           String   @id @default(uuid())
  departmentId String
  jobTitle     String
  gradeLevel   String   // L1, L2, L3, L4
  minSalary    Decimal  @db.Decimal(12, 2)
  maxSalary    Decimal  @db.Decimal(12, 2)
  medianSalary Decimal  @db.Decimal(12, 2)
  currency     String   @default("USD")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  department Department @relation(fields: [departmentId], references: [id])
}

// ─── BACK-OFFICE USERS ───────────────────────────────────

model BackOfficeUser {
  id               String         @id @default(uuid())
  email            String         @unique
  passwordHash     String?
  firstName        String
  lastName         String
  role             BackOfficeRole
  departmentId     String?
  isActive         Boolean        @default(true)
  mfaEnabled       Boolean        @default(false)
  mfaSecret        String?
  lastLoginAt      DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  department       Department?    @relation(fields: [departmentId], references: [id])
  requisitions     JobRequisition[] @relation("RequisitionCreator")
  approvedReqs     JobRequisition[] @relation("RequisitionApprover")
  createdPostings  JobPosting[]   @relation("PostingCreator")
  approvedPostings JobPosting[]   @relation("PostingApprover")
  scorecards       Scorecard[]
  assignedSlots    InterviewSlotConfig[] @relation("AssignedInterviewer")
  auditLogs        AuditLog[]
}

// ─── JOB TEMPLATES & REQUISITIONS ────────────────────────

model JobTemplate {
  id                    String   @id @default(uuid())
  name                  String
  title                 String
  departmentId          String
  employmentType        String
  description           String   @db.Text
  qualifications        String   @db.Text
  benefits              String   @db.Text
  eeoStatement          String   @db.Text
  adaStatement          String   @db.Text
  aedtDisclosure        String   @db.Text
  gradeLevel            String
  interviewRoundConfig  Json     // array of round configs
  aedtWeights           Json     // { skills: 30, experience: 25, ... }
  staticQuestionBank    Json     // role-based interview questions
  isActive              Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  department Department @relation(fields: [departmentId], references: [id])
  postings   JobPosting[]
}

model JobRequisition {
  id              String            @id @default(uuid())
  departmentId    String
  jobTitle        String
  employmentType  String
  numberOfOpenings Int
  justification   String            @db.Text
  targetStartDate DateTime?
  budgetCode      String?
  isNewHeadcount  Boolean           @default(false)
  status          RequisitionStatus @default(DRAFT)
  createdById     String
  approvedById    String?
  approvedAt      DateTime?
  rejectionReason String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  department  Department      @relation(fields: [departmentId], references: [id])
  createdBy   BackOfficeUser  @relation("RequisitionCreator", fields: [createdById], references: [id])
  approvedBy  BackOfficeUser? @relation("RequisitionApprover", fields: [approvedById], references: [id])
  posting     JobPosting?
}

model JobPosting {
  id                String        @id @default(uuid())
  requisitionId     String?       @unique
  templateId        String?
  slug              String        @unique
  title             String
  departmentId      String
  locationId        String
  employmentType    String
  numberOfOpenings  Int           @default(1)
  salaryMin         Decimal       @db.Decimal(12, 2)
  salaryMax         Decimal       @db.Decimal(12, 2)
  salaryCurrency    String        @default("USD")
  description       String        @db.Text
  qualifications    String        @db.Text
  benefits          String        @db.Text
  eeoStatement      String        @db.Text
  adaStatement      String        @db.Text
  aedtDisclosure    String        @db.Text
  gradeLevel        String
  priority          String        @default("NORMAL") // NORMAL, URGENT, HIGH_VOLUME
  hiringManagerId   String?
  aedtWeights       Json
  staticQuestionBank Json
  status            PostingStatus @default(DRAFT)
  complianceResults Json?
  publishedAt       DateTime?
  closedAt          DateTime?
  closureReason     String?
  createdById       String
  approvedById      String?
  approvedAt        DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  requisition    JobRequisition?  @relation(fields: [requisitionId], references: [id])
  template       JobTemplate?     @relation(fields: [templateId], references: [id])
  department     Department       @relation(fields: [departmentId], references: [id])
  location       Location         @relation(fields: [locationId], references: [id])
  createdBy      BackOfficeUser   @relation("PostingCreator", fields: [createdById], references: [id])
  approvedBy     BackOfficeUser?  @relation("PostingApprover", fields: [approvedById], references: [id])
  applications   Application[]
  slotConfigs    InterviewSlotConfig[]
  offers         Offer[]
}

model InterviewSlotConfig {
  id                  String   @id @default(uuid())
  jobPostingId        String
  round               InterviewRound
  durationMinutes     Int      @default(30)
  bufferMinutes       Int      @default(15)
  availableDays       Int[]    // 0=Sun, 1=Mon, ...
  windowStart         String   // "13:00"
  windowEnd           String   // "17:00"
  maxSlotsPerDay      Int      @default(4)
  generationDays      Int      @default(10)
  autoGenerateCalendar Boolean @default(true)
  interviewerId       String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  jobPosting  JobPosting     @relation(fields: [jobPostingId], references: [id])
  interviewer BackOfficeUser @relation("AssignedInterviewer", fields: [interviewerId], references: [id])
  slots       InterviewSlot[]
}

model InterviewSlot {
  id           String   @id @default(uuid())
  configId     String
  startsAt     DateTime // UTC
  endsAt       DateTime // UTC
  isBooked     Boolean  @default(false)
  createdAt    DateTime @default(now())

  config    InterviewSlotConfig @relation(fields: [configId], references: [id])
  interview Interview?
}

model BlackoutDate {
  id         String   @id @default(uuid())
  locationId String?
  userId     String?  // null = global
  date       DateTime @db.Date
  reason     String?
  createdAt  DateTime @default(now())

  location Location? @relation(fields: [locationId], references: [id])
}

// ─── CANDIDATES ──────────────────────────────────────────

model Candidate {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String?
  firstName      String
  lastName       String
  preferredName  String?
  phone          String   // E.164
  preferredContact String @default("EMAIL")
  mfaEnabled     Boolean  @default(false)
  mfaSecret      String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  applications     Application[]
  talentPoolMember TalentPoolMember?
  deletionRequests DataDeletionRequest[]
}

model Application {
  id                  String            @id @default(uuid())
  referenceNumber     String            @unique
  candidateId         String
  jobPostingId        String
  status              ApplicationStatus @default(SUBMITTED)
  source              String
  referralName        String?
  workAuthorization   Boolean
  visaSponsorship     Boolean
  earliestStartDate   DateTime?
  preferredSchedule   String[]
  resumeUrl           String
  resumeFileName      String
  coverLetterUrl      String?
  coverLetterText     String?
  linkedinUrl         String?
  portfolioUrl        String?
  accommodationNeeds  String?
  anythingElse        String?
  classificationScore Int?
  classificationTier  String?
  transferredFromId   String?
  rejectionScheduledAt DateTime?
  rejectedAt          DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  candidate       Candidate       @relation(fields: [candidateId], references: [id])
  jobPosting      JobPosting      @relation(fields: [jobPostingId], references: [id])
  transferredFrom Application?    @relation("ApplicationTransfer", fields: [transferredFromId], references: [id])
  transfers       Application[]   @relation("ApplicationTransfer")
  aedtConsent     AEDTConsent?
  aedtScore       AEDTScore?
  aedtDataRequests AEDTDataRequest[]
  interviews      Interview[]
  scorecards      Scorecard[]
  offer           Offer?

  @@index([candidateId, jobPostingId])
}

model AEDTConsent {
  id            String          @id @default(uuid())
  applicationId String          @unique
  consentType   AEDTConsentType
  consentedAt   DateTime        @default(now())
  ipAddress     String?
  userAgent     String?

  application Application @relation(fields: [applicationId], references: [id])
}

model AEDTScore {
  id            String   @id @default(uuid())
  applicationId String   @unique
  skillsScore   Decimal  @db.Decimal(5, 2)
  experienceScore Decimal @db.Decimal(5, 2)
  educationScore Decimal @db.Decimal(5, 2)
  competencyScore Decimal @db.Decimal(5, 2)
  availabilityScore Decimal @db.Decimal(5, 2)
  totalScore    Decimal  @db.Decimal(5, 2)
  classification String
  isOverridden  Boolean  @default(false)
  overrideReason String?
  overriddenById String?
  scoredAt      DateTime @default(now())

  application Application @relation(fields: [applicationId], references: [id])
}

model AEDTDataRequest {
  id            String   @id @default(uuid())
  applicationId String
  candidateId   String
  status        String   @default("PENDING") // PENDING, REVIEWED, FULFILLED, DENIED
  exportUrl     String?
  reviewedById  String?
  fulfilledAt   DateTime?
  createdAt     DateTime @default(now())

  application Application @relation(fields: [applicationId], references: [id])
}

// EEOC — ISOLATED TABLE, NEVER JOINED TO BRIEFING PACKS
model EEOCData {
  id            String   @id @default(uuid())
  applicationId String   @unique
  gender        String?
  raceEthnicity String?
  veteranStatus String?
  disabilityStatus String?
  submittedAt   DateTime @default(now())

  application Application @relation(fields: [applicationId], references: [id])
}

// ─── INTERVIEWS & SCORECARDS ─────────────────────────────

model Interview {
  id            String          @id @default(uuid())
  applicationId String
  slotId        String          @unique
  round         InterviewRound
  status        InterviewStatus @default(SCHEDULED)
  rescheduleCount Int           @default(0)
  accommodationNotes String?
  completedAt   DateTime?
  noShowAt      DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  application Application   @relation(fields: [applicationId], references: [id])
  slot        InterviewSlot @relation(fields: [slotId], references: [id])
  scorecard   Scorecard?
}

model Scorecard {
  id                    String                  @id @default(uuid())
  applicationId         String
  interviewId           String                  @unique
  interviewerId         String
  recommendation        ScorecardRecommendation
  skillsRating          Int
  communicationRating   Int
  culturalFitRating     Int
  problemSolvingRating  Int
  customerServiceRating Int?
  leadershipRating      Int?
  strengthsObserved     String
  areasOfConcern        String
  teamFitAnswer         String
  submittedAt           DateTime                @default(now())

  application Application    @relation(fields: [applicationId], references: [id])
  interview   Interview      @relation(fields: [interviewId], references: [id])
  interviewer BackOfficeUser @relation(fields: [interviewerId], references: [id])
}

// ─── OFFERS ──────────────────────────────────────────────

model Offer {
  id              String      @id @default(uuid())
  applicationId   String      @unique
  jobPostingId    String
  status          OfferStatus @default(DRAFT)
  salaryAmount    Decimal     @db.Decimal(12, 2)
  salaryCurrency  String      @default("USD")
  payFrequency    String      // ANNUAL, HOURLY
  flsaStatus      String      // EXEMPT, NON_EXEMPT
  startDate       DateTime
  schedule        String
  reportingLine   String
  benefitsSummary String      @db.Text
  expirationDate  DateTime
  payEquityFlag   Boolean     @default(false)
  payEquityNotes  String?
  pdfUrl          String?
  signedPdfUrl    String?
  declineReason   String?
  generatedById   String
  approvedById    String?
  financeApprovedById String?
  sentAt          DateTime?
  respondedAt     DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  application Application @relation(fields: [applicationId], references: [id])
  jobPosting  JobPosting  @relation(fields: [jobPostingId], references: [id])
}

// ─── TALENT POOL ─────────────────────────────────────────

model TalentPoolMember {
  id                  String   @id @default(uuid())
  candidateId         String?  @unique
  firstName           String
  lastName            String
  email               String   @unique
  phone               String?
  departmentsOfInterest String[]
  employmentPreferences String[]
  resumeUrl           String?
  linkedinUrl         String?
  source              String
  introduction        String?
  consentGivenAt      DateTime
  expiresAt           DateTime
  renewalSentAt       DateTime?
  unsubscribedAt      DateTime?
  createdAt           DateTime @default(now())

  candidate Candidate? @relation(fields: [candidateId], references: [id])
}

// ─── COMPLIANCE & AUDIT ──────────────────────────────────

model AuditLog {
  id         String      @id @default(uuid())
  action     AuditAction
  actorId    String?
  actorRole  String?
  ipAddress  String?
  targetType String
  targetId   String
  metadata   Json?
  createdAt  DateTime    @default(now())

  actor BackOfficeUser? @relation(fields: [actorId], references: [id])

  @@index([targetType, targetId])
  @@index([action, createdAt])
}

model DataDeletionRequest {
  id          String   @id @default(uuid())
  candidateId String
  status      String   @default("PENDING") // PENDING, VERIFIED, COMPLETED, DENIED
  reason      String?
  verifiedAt  DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())

  candidate Candidate @relation(fields: [candidateId], references: [id])
}

model ComplianceKeyword {
  id       String @id @default(uuid())
  keyword  String @unique
  category String // AGE, GENDER, OTHER
  isActive Boolean @default(true)
}

model SystemSetting {
  id    String @id @default(uuid())
  key   String @unique
  value Json
}
// Keys: single_interviewer_mode, same_day_interview_mode, aedt_audit_published, aedt_scoring_enabled
```

**Important:** Add `Application` relation to `EEOCData` in Application model:

```prisma
  eeocData EEOCData?
```

Add missing relations on `Department`, `BackOfficeUser`, `JobTemplate` as needed when generating migration.

---

## 5. Backend Module Breakdown

Create under `services/careers-api/src/`:

| Module | Path | Responsibility |
|--------|------|----------------|
| `AppModule` | `app.module.ts` | Root imports, global guards |
| `DatabaseModule` | `database/` | PrismaService |
| `AuthModule` | `auth/` | Back-office JWT + Candidate JWT (separate strategies) |
| `RbacModule` | `rbac/` | RolesGuard, PermissionsGuard, permission matrix |
| `LocationsModule` | `locations/` | Location CRUD |
| `DepartmentsModule` | `departments/` | Department + PayBand CRUD |
| `TemplatesModule` | `job-templates/` | Job template CRUD |
| `RequisitionsModule` | `requisitions/` | Requisition workflow |
| `PostingsModule` | `postings/` | Posting lifecycle + compliance validation |
| `ApplicationsModule` | `applications/` | Application CRUD, status machine, withdraw |
| `CandidatesModule` | `candidates/` | Candidate auth, portal profile |
| `AedtModule` | `aedt/` | Consent, scoring (stub), override, data requests |
| `EeocModule` | `eeoc/` | Isolated EEOC collection — strict access guard |
| `InterviewsModule` | `interviews/` | Slot config, slot generation, booking, reschedule |
| `ScorecardsModule` | `scorecards/` | Briefing packs, scorecard submission |
| `OffersModule` | `offers/` | Offer generation, approval chain, PDF, accept/decline |
| `TalentPoolModule` | `talent-pool/` | Registration, matching, renewal, unsubscribe |
| `ComplianceModule` | `compliance/` | Keyword scan, pay equity flag, jurisdiction rules |
| `NotificationsModule` | `notifications/` | Email queue + template rendering |
| `StorageModule` | `storage/` | S3 upload, signed URLs, malware scan hook |
| `DocumentsModule` | `documents/` | Offer letter PDF generation (pdfkit) |
| `AuditModule` | `audit/` | Append-only audit log writer + reader |
| `RetentionModule` | `retention/` | Flag records for deletion, batch confirm |
| `AnalyticsModule` | `analytics/` | Basic counts (applications, hires, sources) |
| `SettingsModule` | `settings/` | Single interviewer mode, same-day mode toggles |
| `QueueModule` | `queue/` | BullMQ setup with `careers:` prefix |
| `HealthModule` | `health/` | `/api/health/live` |

### Application Status State Machine

Implement in `ApplicationsService.transitionStatus()`:

```
SUBMITTED
  → PENDING_AEDT_WINDOW (if standard wait)
  → AEDT_SCORING (if expedited consent)
  → MANUAL_REVIEW (if opt-out)

PENDING_AEDT_WINDOW → AEDT_SCORING (after 10 business days cron)

AEDT_SCORING → SHORTLISTED | HR_REVIEW | BELOW_THRESHOLD | ARCHIVED

MANUAL_REVIEW → SHORTLISTED | HR_REVIEW | BELOW_THRESHOLD | ARCHIVED (within SLA)

SHORTLISTED → INTERVIEW_SCHEDULING → INTERVIEWING → OFFER_PENDING → OFFER_SENT → OFFER_ACCEPTED | OFFER_DECLINED

Any active status → WITHDRAWN (candidate action)
Any active status → REJECTED (HR manual, 24h cooling before email)
BELOW_THRESHOLD | ARCHIVED → can be overridden back to HR_REVIEW by HR Director/Admin
```

---

## 6. REST API Specification

Base URL: `/api/v1`  
All responses: `ApiResponse<T>` or `PaginatedResponse<T>`

### 6.1 Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs` | List published postings. Query: `dept`, `type`, `sort` |
| GET | `/jobs/:slug` | Posting detail + JSON-LD metadata |
| POST | `/applications` | Submit application (multipart: resume file + JSON fields). Honeypot validation. |
| POST | `/eeoc/:applicationId` | Submit EEOC self-ID (token from confirmation email) |
| POST | `/talent-pool` | Register for talent pool |
| GET | `/talent-pool/unsubscribe/:token` | Unsubscribe from talent pool |

### 6.2 Candidate Portal (`/portal/*` — Candidate JWT)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/portal/auth/register` | Create account (post-first-application) |
| POST | `/portal/auth/login` | Login |
| POST | `/portal/auth/forgot-password` | Password reset |
| GET | `/portal/dashboard` | Applications + timeline + action items |
| GET | `/portal/applications/:id` | Application detail |
| POST | `/portal/applications/:id/withdraw` | Withdraw |
| GET | `/portal/interviews` | List interviews |
| GET | `/portal/interviews/:postingId/slots` | Available slots for booking |
| POST | `/portal/interviews/:postingId/book` | Book slot |
| POST | `/portal/interviews/:id/reschedule` | Reschedule (max 1) |
| GET | `/portal/offers/:id` | View offer + PDF URL |
| POST | `/portal/offers/:id/accept` | Accept + upload signed PDF |
| POST | `/portal/offers/:id/decline` | Decline with reason |
| POST | `/portal/aedt-data-request` | Request AEDT data export |
| POST | `/portal/data-deletion` | Request account/data deletion |
| POST | `/portal/data-deletion/verify/:token` | Verify deletion via email link |

### 6.3 Back-Office (`/admin/*` — BackOffice JWT + RBAC)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/admin/requisitions` | HR+ | List requisitions |
| POST | `/admin/requisitions` | HM, HR+ | Create requisition |
| PATCH | `/admin/requisitions/:id/approve` | HR Director, Super Admin* | Approve requisition |
| GET | `/admin/postings` | HR+ | List postings |
| POST | `/admin/postings` | HR Admin+ | Create from template |
| POST | `/admin/postings/:id/compliance-check` | HR Admin+ | Run compliance validation |
| PATCH | `/admin/postings/:id/approve` | HR Director, Super Admin* | Approve posting |
| PATCH | `/admin/postings/:id/publish` | HR Admin+ | Publish |
| PATCH | `/admin/postings/:id/hold` | HR Admin+ | Put on hold |
| PATCH | `/admin/postings/:id/close` | HR Admin+ | Close (filled/cancelled) |
| POST | `/admin/postings/:id/slots` | HR Admin+ | Configure interview slots |
| POST | `/admin/postings/:id/generate-slots` | HR Admin+ | Generate slot instances |
| GET | `/admin/applications` | HR+ | List applications (RBAC filtered) |
| GET | `/admin/applications/:id` | HR+ | Application detail |
| GET | `/admin/applications/:id/briefing` | HM+, Interviewer | Briefing pack (NO EEOC) |
| PATCH | `/admin/applications/:id/status` | HR+ | Change status |
| PATCH | `/admin/applications/:id/override-score` | HR Director, HR Admin | Override AEDT score |
| POST | `/admin/applications/:id/decline` | HR Admin, HM | Schedule rejection (24h cooling) |
| POST | `/admin/applications/:id/transfer` | HR Admin | Initiate transfer consent |
| POST | `/admin/interviews/:id/no-show` | Interviewer, HR+ | Mark candidate no-show |
| POST | `/admin/scorecards` | Interviewer, HM, HR+ | Submit scorecard |
| GET | `/admin/scorecards/overdue` | HR Admin+ | Overdue scorecards |
| POST | `/admin/offers` | HR Admin+ | Generate offer |
| PATCH | `/admin/offers/:id/approve` | HR Director, Super Admin* | HR approval |
| PATCH | `/admin/offers/:id/finance-approve` | Finance | Finance approval |
| PATCH | `/admin/offers/:id/send` | HR Admin+ | Send to candidate |
| GET | `/admin/talent-pool` | HR+ | List members |
| GET | `/admin/audit-log` | Super Admin, HR Director, Legal | Audit trail |
| GET | `/admin/retention/pending` | HR Admin+ | Records flagged for deletion |
| POST | `/admin/retention/confirm-batch` | HR Admin+ | Confirm batch deletion |
| GET | `/admin/analytics/summary` | HR+ | Basic counts |
| PATCH | `/admin/settings/single-interviewer-mode` | HR Director+ | Toggle |
| PATCH | `/admin/settings/same-day-interview-mode` | HR Admin+ | Toggle |
| GET | `/admin/aedt-data-requests` | HR Admin+ | Pending AEDT data requests |
| PATCH | `/admin/aedt-data-requests/:id/fulfill` | HR Admin+ | Release export |

*Super Admin = emergency override only, logged as `EMERGENCY_APPROVAL`

---

## 7. Frontend Pages (careers-web)

App Router under `apps/careers-web/src/app/`:

### 7.1 Public Pages

| Route | Page |
|-------|------|
| `/` | Careers landing — filterable job list |
| `/jobs/[slug]` | Job detail + Apply button + JSON-LD |
| `/jobs/[slug]/apply` | AEDT consent screen |
| `/jobs/[slug]/apply/form` | 4-section application form |
| `/jobs/[slug]/apply/eeoc` | EEOC self-identification |
| `/jobs/[slug]/apply/confirmation` | Reference number + portal register link |
| `/talent-pool` | Talent pool registration |
| `/talent-pool/confirmation` | Success message |

### 7.2 Candidate Portal (`/portal/*`)

| Route | Page |
|-------|------|
| `/portal/login` | Login |
| `/portal/register` | Register (from confirmation email link) |
| `/portal/dashboard` | Dashboard |
| `/portal/applications/[id]` | Application detail + withdraw |
| `/portal/interviews` | Interview list + slot picker |
| `/portal/offers/[id]` | Offer view + accept/decline + upload signed PDF |
| `/portal/data-deletion` | Request deletion |

### 7.3 Back-Office (`/admin/*`)

| Route | Page |
|-------|------|
| `/admin/login` | Back-office SSO/login |
| `/admin/dashboard` | HR overview |
| `/admin/requisitions` | Requisition list + create |
| `/admin/postings` | Posting list + workflow actions |
| `/admin/postings/[id]` | Posting detail + compliance + slots |
| `/admin/applications` | Application pipeline |
| `/admin/applications/[id]` | Application detail + actions |
| `/admin/applications/[id]/briefing` | Briefing pack |
| `/admin/interviews` | Interview calendar |
| `/admin/scorecards/[interviewId]` | Scorecard form |
| `/admin/offers/[id]` | Offer builder + approval |
| `/admin/talent-pool` | Talent pool management |
| `/admin/retention` | Pending deletions batch |
| `/admin/audit-log` | Audit trail viewer |
| `/admin/settings` | System toggles |

### 7.4 Layout & Branding

- Use `@hos-marketplace/theme-system` fonts: `font-primary` (Cinzel), `font-secondary` (Lora)
- HOS brand colors from existing theme
- WCAG 2.1 AA: keyboard nav, focus indicators, 4.5:1 contrast, form error association

---

## 8. Authentication

### 8.1 Candidate Auth (separate)

- Register after first application (email verification optional Phase 1)
- JWT payload: `{ sub: candidateId, type: 'candidate' }`
- Secret: `CAREERS_CANDIDATE_JWT_SECRET`
- Cookie: `careers_candidate_token` (HttpOnly)
- Optional TOTP MFA

### 8.2 Back-Office Auth (separate)

- Email + password + MFA (TOTP)
- JWT payload: `{ sub: userId, type: 'backoffice', role: BackOfficeRole }`
- Secret: `CAREERS_BACKOFFICE_JWT_SECRET`
- Cookie: `careers_admin_token` (HttpOnly)
- Future: SSO via existing HOS OAuth (Phase 1.5)

### 8.3 Guards

```typescript
// Global guard — skip with @Public()
@UseGuards(CandidateJwtGuard)  // portal routes
@UseGuards(BackOfficeJwtGuard, RolesGuard)
@Roles('HR_ADMIN', 'HR_DIRECTOR')
```

---

## 9. RBAC Implementation

Implement permission matrix from spec §4.2 in `rbac/permissions.constants.ts`:

```typescript
export const PERMISSIONS = {
  'postings.publish': ['SUPER_ADMIN', 'HR_DIRECTOR', 'HR_ADMIN'],
  'applications.view.all': ['SUPER_ADMIN', 'HR_DIRECTOR', 'HR_ADMIN'],
  'applications.view.dept': ['HIRING_MANAGER'],
  'offers.approve.hr': ['HR_DIRECTOR'], // + SUPER_ADMIN emergency
  'offers.approve.finance': ['FINANCE_APPROVER'],
  'eeoc.view.aggregate': ['HR_DIRECTOR', 'LEGAL_COMPLIANCE'],
  // ...
} as const;
```

**Row-level security:** Hiring Managers see only `departmentId` match. Interviewers see briefing for all candidates (per resolved decision).

**EEOC guard:** `EeocGuard` blocks ALL individual EEOC access. Only aggregate endpoint for HR Director + Legal.

---

## 10. Background Jobs & Cron

Register in `QueueModule` with prefix `careers:`:

| Job Type | Cron / Trigger | Handler |
|----------|----------------|---------|
| `CAREERS_AEDT_WINDOW_EXPIRE` | Daily 2 AM ET | Move PENDING_AEDT_WINDOW → AEDT_SCORING after 10 business days |
| `CAREERS_AEDT_SCORE` | On demand | Run AEDT scoring (disabled until audit flag set) |
| `CAREERS_MANUAL_REVIEW_SLA` | Daily 9 AM ET | Day 3/5/7 SLA alerts |
| `CAREERS_REJECTION_SEND` | Every hour | Send rejections where `rejectionScheduledAt` <= now |
| `CAREERS_SCORECARD_REMINDER` | Every hour | 12h/24h scorecard reminders |
| `CAREERS_OFFER_OVERDUE_FLAG` | Daily | Flag offers past expirationDate |
| `CAREERS_RETENTION_SCAN` | Daily 2 AM ET | Flag records past retention period |
| `CAREERS_TALENT_POOL_RENEWAL` | Daily | Send month-11 renewal emails |
| `CAREERS_TALENT_POOL_EXPIRE` | Daily | Delete expired talent pool records |
| `CAREERS_SLOT_GENERATE` | On publish + daily | Regenerate rolling slot windows |
| `CAREERS_EMAIL` | On demand | Send templated email via nodemailer |
| `CAREERS_TALENT_POOL_MATCH` | On publish | Notify matching talent pool members |

---

## 11. Notification Templates

Create in `services/careers-api/src/templates/` (mirror existing `TemplatesService` pattern):

| Slug | Key Variables |
|------|---------------|
| `careers_application_confirmation` | `{{firstName}}`, `{{referenceNumber}}`, `{{jobTitle}}`, `{{portalRegisterUrl}}` |
| `careers_interview_invitation` | `{{firstName}}`, `{{jobTitle}}`, `{{slotPickerUrl}}` |
| `careers_interview_scheduled` | `{{firstName}}`, `{{date}}`, `{{time}}`, `{{location}}`, `{{interviewerName}}` |
| `careers_interview_reminder` | `{{firstName}}`, `{{date}}`, `{{time}}`, `{{location}}` |
| `careers_next_round_invitation` | `{{firstName}}`, `{{round}}`, `{{slotPickerUrl}}` |
| `careers_offer_letter` | `{{firstName}}`, `{{jobTitle}}`, `{{salary}}`, `{{startDate}}`, `{{offerPortalUrl}}`, `{{pdfUrl}}` |
| `careers_offer_accepted` | `{{firstName}}`, `{{jobTitle}}`, `{{startDate}}` |
| `careers_rejection_generic` | `{{firstName}}`, `{{jobTitle}}`, `{{talentPoolUrl}}` |
| `careers_position_on_hold` | `{{firstName}}`, `{{jobTitle}}` |
| `careers_talent_pool_welcome` | `{{firstName}}` |
| `careers_talent_pool_match` | `{{firstName}}`, `{{jobTitle}}`, `{{applyUrl}}` |
| `careers_talent_pool_renewal` | `{{firstName}}`, `{{renewUrl}}`, `{{unsubscribeUrl}}` |
| `careers_transfer_consent` | `{{firstName}}`, `{{fromTitle}}`, `{{toTitle}}`, `{{consentUrl}}` |
| `careers_data_deletion_confirmation` | `{{firstName}}` |

All templates: HOS branded HTML + plain-text fallback + ADA accommodation footer.

---

## 12. File Storage & Malware Scanning

### Upload flow

1. Validate MIME (PDF, DOCX, JPEG, PNG) + magic bytes
2. Scan via ClamAV (local) or cloud API hook — **block if infected**
3. Upload to S3: `careers/resumes/{applicationId}/{uuid}.{ext}`
4. Store signed URL reference in DB (never public ACL)

### Deletion

On retention batch confirm: delete S3 objects + anonymize DB record.

---

## 13. Compliance Engine

`ComplianceService.validatePosting(posting)`:

1. `salaryMin` and `salaryMax` present → else BLOCK
2. `salaryMax / salaryMin > 2` → FLAG (not block)
3. Scan description + qualifications against `ComplianceKeyword` table
4. Verify `eeoStatement`, `adaStatement`, `aedtDisclosure` non-empty
5. Return `{ passed: boolean, flags: string[], blocks: string[] }`

`PayEquityService.checkOffer(offer)`:

- Lookup `PayBand` by job title + department
- If `|offer.salary - median| / median > 0.15` → set `payEquityFlag = true`

---

## 14. AEDT Scoring Engine (Stub for Audit)

**Phase 1 implementation:**

```typescript
// aedt/aedt-scoring.service.ts
async scoreApplication(applicationId: string): Promise<AEDTScore> {
  if (!await this.settingsService.isAedtScoringEnabled()) {
    throw new ForbiddenException('AEDT scoring disabled pending bias audit');
  }
  // Parse resume, compute dimension scores, persist AEDTScore
}
```

- `SystemSetting` key `aedt_scoring_enabled` defaults to `false`
- `SystemSetting` key `aedt_audit_published_url` for public audit summary link
- Manual review path fully functional without scoring
- Resume parsing: extract text from PDF/DOCX (pdf-parse, mammoth)

**Launch gate:** HR Director sets `aedt_scoring_enabled = true` only after audit complete.

---

## 15. Implementation Phases (Suggested Order)

Build in this order to enable incremental testing:

### Phase A: Foundation
1. Scaffold `services/careers-api` + `apps/careers-web`
2. Prisma schema + initial migration
3. DatabaseModule, HealthModule, AuthModule (both auth types)
4. RBAC guards + AuditModule

### Phase B: Job Posting Pipeline
5. Locations, Departments, PayBands
6. JobTemplates, Requisitions, Postings
7. ComplianceService + keyword seed
8. Public job listing pages + SEO JSON-LD

### Phase C: Application Intake
9. ApplicationsModule + file upload + malware scan
10. AEDT consent screen + EEOC isolated module
11. Application form UI (4 sections, honeypot, no auto-save)
12. Confirmation email + candidate registration

### Phase D: Screening
13. AEDT scoring stub (disabled by default)
14. Manual review queue + SLA cron
15. Classification + override UI

### Phase E: Interviews
16. InterviewSlotConfig + slot generation
17. Blackout dates + calendar sync hook (Google/Outlook OAuth Phase 1.5 — manual slots first)
18. Candidate portal: slot booking + reschedule
19. Briefing pack + static question banks
20. Scorecard submission + 24h deadline enforcement

### Phase F: Offers
21. Offer PDF generation (pdfkit + NYC template)
22. Approval workflow + pay equity flag
23. Portal offer accept/decline + signed PDF upload
24. Rejection workflow (24h cooling cron)

### Phase G: Talent Pool & Retention
25. TalentPoolModule + matching on publish
26. Retention scan + batch confirm UI
27. Data deletion request flow

### Phase H: Polish
28. Single interviewer mode toggle + rules enforcement
29. Same-day interview mode
30. Walk-in QR tracking
31. Basic analytics summary
32. WCAG audit + axe-core in CI

---

## 16. Railway Deployment Plan

**Do NOT deploy until UAT sign-off.** This section is planning only.

### 16.1 New Railway Services

| Railway Service | Source | Dockerfile | Public Domain |
|-----------------|--------|------------|---------------|
| `@hos-marketplace/careers-api` | `services/careers-api/` | `services/careers-api/Dockerfile` | Internal or `careers-api.houseofspells.com` |
| `@hos-marketplace/careers-web` | `apps/careers-web/` | `apps/careers-web/Dockerfile` | `us.career.houseofspells.com` |

### 16.2 New Railway Resources

| Resource | Notes |
|----------|-------|
| **PostgreSQL (careers)** | **Separate instance** — NOT shared with e-commerce DB. Name: `careers-postgres` |
| **Redis** | Share existing Redis service. Use key prefix `careers:` in BullMQ config |

### 16.3 Branch Configuration

| Service | Git Branch | Watch Paths |
|---------|------------|-------------|
| `@hos-marketplace/careers-api` | `feature/careers-portal` (initially), merge to `master` when ready | `/services/careers-api/**`, `/packages/**` |
| `@hos-marketplace/careers-web` | `feature/careers-portal` (initially) | `/apps/careers-web/**`, `/packages/**` |

**Recommended approach:**
1. Develop entirely on `feature/careers-portal`
2. Create Railway services pointing to `feature/careers-portal` branch for staging
3. UAT on staging URLs
4. Merge to `master` → switch Railway branch to `master` for production

### 16.4 Environment Variables

#### careers-api

```bash
# Required
DATABASE_URL=postgresql://...@careers-postgres.railway.internal:5432/hos_careers
REDIS_URL=redis://...@redis.railway.internal:6379
CAREERS_CANDIDATE_JWT_SECRET=<strong-secret>
CAREERS_BACKOFFICE_JWT_SECRET=<strong-secret>
PORT=3002
NODE_ENV=production
FRONTEND_URL=https://us.career.houseofspells.com

# Storage
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_S3_REGION=us-east-1
CAREERS_S3_PREFIX=careers/

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CAREERS_FROM_EMAIL=careers@houseofspells.com

# Feature flags
AEDT_SCORING_ENABLED=false
AEDT_AUDIT_PUBLISHED_URL=

# Optional
MALWARE_SCAN_ENABLED=true
SENTRY_DSN=
```

#### careers-web

```bash
NEXT_PUBLIC_CAREERS_API_URL=https://careers-api.houseofspells.com/api/v1
NEXT_PUBLIC_SITE_URL=https://us.career.houseofspells.com
NODE_ENV=production
PORT=3003
```

### 16.5 DNS Configuration

```
us.career.houseofspells.com  →  CNAME  →  careers-web Railway domain
careers-api.houseofspells.com →  CNAME  →  careers-api Railway domain (if public)
```

### 16.6 Health Checks

Both services expose:

```
GET /api/health/live  →  { status: 'ok' }
```

`railway.toml` per service:

```toml
[deploy]
healthcheckPath = "/api/health/live"
healthcheckTimeout = 300
```

### 16.7 Deployment Commands (when ready — NOT now)

```bash
# Staging deploy from feature branch
railway service "@hos-marketplace/careers-api"
railway up --detach

railway service "@hos-marketplace/careers-web"
railway up --detach

# Run migrations
railway run --service "@hos-marketplace/careers-api" pnpm db:migrate:deploy

# Logs
railway logs -s "@hos-marketplace/careers-api"
railway logs -s "@hos-marketplace/careers-web"
```

### 16.8 Security Checklist (pre-production)

- [ ] Separate DATABASE_URL (not e-commerce DB)
- [ ] Separate JWT secrets
- [ ] TLS 1.3 enforced (Railway default)
- [ ] S3 bucket encryption AES-256
- [ ] MFA enabled for all back-office users
- [ ] AEDT scoring disabled until audit complete
- [ ] Pen test scheduled
- [ ] SHIELD Act breach notification process documented

---

## 17. Git Branch Strategy

```
master (production — e-commerce + careers when merged)
  └── feature/careers-portal (all careers development)
        ├── docs/CAREERS_PORTAL_SPEC.md
        ├── docs/CAREERS_BUILD_INSTRUCTIONS.md
        ├── services/careers-api/ (scaffold + implementation)
        └── apps/careers-web/ (scaffold + implementation)
```

**Rules:**
- All careers work on `feature/careers-portal` — never commit careers code directly to `master`
- E-commerce `services/api` and `apps/web` remain **unchanged** on this branch until explicit integration (e.g., footer link to careers URL)
- Merge to `master` only after: UAT pass, legal sign-off, AEDT audit decision, security review
- Use conventional commits: `feat(careers): ...`, `fix(careers): ...`

**First commit on branch (this task):**
```
docs(careers): add Phase 1 portal spec and build instructions
```

---

## 18. What NOT to Build (Phase 1)

Explicitly exclude from all modules:

- Onboarding / pre-boarding workflows
- E-signature (DocuSign/HelloSign) integration
- SMS / Twilio notifications
- Video conferencing (Zoom/Teams/Meet)
- Application auto-save / draft recovery
- Resume email alternative
- Conditional vs final offer status machine
- Background check / FCRA workflow in system
- Internal mobility / employee job board
- Referral program backend (manual only)
- Analytics dashboards (counts endpoint only)
- Finance approval at requisition stage
- Assisted application / in-store kiosk
- AI-generated interview guides (use static question banks)
- Automated slot-selection reminders
- Auto-expiration of offers

---

## 19. Verification Checklist

Before marking Phase 1 complete:

### Functional
- [ ] Publish job posting blocked without salary range
- [ ] Prohibited keyword flagged in posting description
- [ ] Application form rejects honeypot submissions
- [ ] Resume malware scan blocks infected file
- [ ] AEDT consent screen cannot be bypassed
- [ ] EEOC data never appears in briefing pack API response
- [ ] Max 3 simultaneous applications enforced
- [ ] Candidate can book, reschedule (1x), withdraw
- [ ] Scorecard overdue blocks next round
- [ ] Offer pay equity flag triggers when salary >15% from median
- [ ] Rejection email sends after 24h cooling period
- [ ] Talent pool renewal email at month 11
- [ ] Retention batch flag + HR confirm deletes PII + S3 files
- [ ] Super Admin emergency approval logged in audit trail

### Compliance
- [ ] Legal counsel sign-off documented
- [ ] AEDT audit summary published before enabling scoring
- [ ] WCAG 2.1 AA manual audit passed
- [ ] All 14 email templates reviewed for compliance language

### Infrastructure
- [ ] Separate PostgreSQL verified (no e-commerce tables)
- [ ] Health checks passing on Railway staging
- [ ] `us.career.houseofspells.com` DNS configured
- [ ] Google Jobs JSON-LD validates in Rich Results Test

---

## Quick Start for Composer 2.5

When prompted to build, use this sequence:

```
1. Read docs/CAREERS_PORTAL_SPEC.md for business rules
2. Create branch feature/careers-portal (if not exists)
3. Scaffold services/careers-api per §3 and §5
4. Add Prisma schema from §4, run db:migrate
5. Implement modules in order from §15
6. Scaffold apps/careers-web per §7
7. Wire API client to NEXT_PUBLIC_CAREERS_API_URL
8. Seed: departments, locations, compliance keywords, pay bands, job templates
9. Do NOT enable AEDT scoring (AEDT_SCORING_ENABLED=false)
10. Do NOT deploy to Railway until §19 checklist complete
```

---

*End of build specification.*
