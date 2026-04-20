# Phase 6 — Segmentation Engine: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-6-segmentation`  
**Base:** `feature/loyalty-phase-5-events` (all Phase 1–5 work merged)  
**Estimated:** 3–4 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Segmentation Module — Core Service](#3-segmentation-module--core-service)
4. [Rule DSL & Filter Engine](#4-rule-dsl--filter-engine)
5. [Dynamic Evaluation & Membership Refresh](#5-dynamic-evaluation--membership-refresh)
6. [Pre-Built Segment Templates](#6-pre-built-segment-templates)
7. [Journey & Broadcast Integration](#7-journey--broadcast-integration)
8. [REST API Endpoints (Admin)](#8-rest-api-endpoints-admin)
9. [Admin Frontend Pages](#9-admin-frontend-pages)
10. [API Client Extensions](#10-api-client-extensions)
11. [Environment Variables](#11-environment-variables)
12. [Testing Strategy](#12-testing-strategy)
13. [Migration & Seed Script](#13-migration--seed-script)
14. [Acceptance Criteria](#14-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 6, confirm:

- [ ] Phase 1–5 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 160+ loyalty, POS, quiz, journey, messaging, and event tests pass (`npx jest --testPathPattern="(loyalty|pos|quiz|journey|messaging|abandoned-cart|events)"`)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–5 services are functional:
  - `LoyaltyService` (enrollment, check-in, earn, redeem, preferences)
  - `LoyaltyWalletService` (applyDelta for EARN/BURN/BONUS transactions)
  - `LoyaltyTierEngine` (recalculateTier with composite scoring)
  - `LoyaltyEventService` (onTierChange with marketing bus emit)
  - `LoyaltyListener` (Phase 3 hooks: review, social, quest, quiz, referral)
  - `FandomProfileService` (recompute → `LoyaltyMembership.fandomProfile` Json)
  - `MessagingService` (consent-aware multi-channel send with unsubscribe tokens)
  - `MarketingEventBus` (emit + broadcast for system-level events)
  - `JourneyService` (enrollment, processStep with SEND/WAIT/CONDITION/SPLIT, matchesTriggerConditions)
  - `NotificationsService` (SMTP email via BullMQ, template rendering)
  - `QueueService` / BullMQ (job queue, repeatable cron, processors)
  - `EventsService` (RSVP, check-in, attendance tracking, loyalty integration)
- [ ] Existing models to leverage:
  - `User` (id, email, firstName, lastName, phone, country, birthday, lastLoginAt, favoriteFandoms[], role, customerGroupId, loyaltyMembership, addresses[], eventRsvps[], eventAttendances[], quizAttempts[])
  - `Address` (userId, city, state, postalCode, country, isDefault)
  - `LoyaltyMembership` (userId, tierId, tier, currentBalance, totalPointsEarned, totalPointsRedeemed, compositeScore, totalSpend, purchaseCount, engagementCount, regionCode, enrollmentChannel, enrolledAt, fandomProfile Json, optIn*)
  - `LoyaltyTier` (id, slug, name, level, minPoints)
  - `LoyaltyTransaction` (membershipId, type, points, source, sourceId, channel, storeId, createdAt)
  - `POSSale` (storeId, customerId, customerEmail, totalAmount, currency, saleDate)
  - `EventAttendance` (eventId, userId, checkedInAt, pointsAwarded)
  - `FandomQuizAttempt` (quizId, userId, score, pointsAwarded, completedAt)
  - `CustomerGroup` (id, name, type, isActive)
  - `NewsletterSubscription` (email, userId, status, tags Json)
  - `MarketingJourney` (slug, triggerEvent, triggerConditions Json, regionCodes[], channelCodes[])
  - `JourneyEnrollment` (journeyId, userId, status, startedAt, completedAt)
  - `MessageLog` (userId, channel, status, sentAt, deliveredAt, openedAt, clickedAt)
  - `Fandom` (id, name, slug, isActive)
- [ ] Existing `JobType` values in `queue.bullmq.impl.ts` (do NOT modify existing ones):
  - `EMAIL_NOTIFICATION`, `LOYALTY_TIER_REVIEW`, `LOYALTY_POINTS_EXPIRY`, `LOYALTY_BIRTHDAY_BONUS`
  - `FANDOM_PROFILE_RECOMPUTE`, `POS_*` (6 types), `JOURNEY_STEP_PROCESS`, `ABANDONED_CART_SCAN`
  - `INACTIVITY_SCAN`, `MESSAGE_SEND`, `MARKETING_POINTS_EXPIRY_WARNING`
  - `EVENT_REMINDER`, `EVENT_ATTENDANCE_RECONCILE`
- [ ] Note: `LoyaltyMembership` does **NOT** have a `lastActivityAt` field — Phase 6 adds it (see §2.2)
- [ ] Note: `User` does **NOT** have a `city` field — city is on the `Address` model, accessed via `user.addresses`
- [ ] Note: Fandom affinity is stored as `LoyaltyMembership.fandomProfile` (Json, not a separate model)

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**AudienceSegment — a named, reusable audience definition with composable filter rules:**

```prisma
model AudienceSegment {
  id           String    @id @default(uuid())
  slug         String    @unique
  name         String
  description  String?   @db.Text
  type         String    @default("DYNAMIC")  // DYNAMIC, STATIC, TEMPLATE
  status       String    @default("ACTIVE")   // ACTIVE, PAUSED, ARCHIVED
  rules        Json                           // SegmentRuleGroup (see §4)
  memberCount  Int       @default(0)          // Cached count, updated on refresh
  lastEvaluatedAt DateTime?                   // When membership was last recomputed
  refreshCron  String?                        // Optional cron override (null = use global default)
  isTemplate   Boolean   @default(false)      // True for pre-built templates (seed data)
  templateSlug String?   @unique              // e.g. "vip-at-risk", "rising-stars"

  createdBy    String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  members      SegmentMembership[]
  journeys     MarketingJourney[]             // Journeys that reference this segment

  @@index([status])
  @@index([type])
  @@index([isTemplate])
  @@map("audience_segments")
}
```

**SegmentMembership — materialized membership (which users are in which segments):**

```prisma
model SegmentMembership {
  id         String   @id @default(uuid())
  segmentId  String
  segment    AudienceSegment @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt   DateTime @default(now())
  metadata   Json?    // Why they matched (optional debug info)

  @@unique([segmentId, userId])
  @@index([userId])
  @@index([segmentId])
  @@map("segment_memberships")
}
```

### 2.2 Model Additions

**Add to `User` model:**

```prisma
model User {
  // ... existing fields ...
  segmentMemberships  SegmentMembership[]
}
```

**Add to `LoyaltyMembership` model:**

```prisma
model LoyaltyMembership {
  // ... existing fields ...
  lastActivityAt  DateTime?    // Updated on any earn/burn/event/quiz action
}
```

**Add to `MarketingJourney` model:**

```prisma
model MarketingJourney {
  // ... existing fields ...
  segmentId    String?
  segment      AudienceSegment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)
}
```

### 2.3 JobType Additions

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
export enum JobType {
  // ... existing values ...
  SEGMENT_REFRESH = 'segmentation:refresh',
  SEGMENT_REFRESH_ALL = 'segmentation:refresh-all',
}
```

### 2.4 Manual Migration Script

Create `services/api/prisma/migrations/20260601000000_phase6_segmentation_engine/migration.sql`:

```sql
-- Phase 6: Segmentation Engine

-- Add lastActivityAt to loyalty_memberships
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

-- Add segmentId to marketing_journeys
ALTER TABLE "marketing_journeys" ADD COLUMN IF NOT EXISTS "segmentId" TEXT;

-- AudienceSegment table
CREATE TABLE IF NOT EXISTS "audience_segments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DYNAMIC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rules" JSONB NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvaluatedAt" TIMESTAMP(3),
    "refreshCron" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateSlug" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audience_segments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "audience_segments_slug_key" ON "audience_segments"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "audience_segments_templateSlug_key" ON "audience_segments"("templateSlug");
CREATE INDEX IF NOT EXISTS "audience_segments_status_idx" ON "audience_segments"("status");
CREATE INDEX IF NOT EXISTS "audience_segments_type_idx" ON "audience_segments"("type");
CREATE INDEX IF NOT EXISTS "audience_segments_isTemplate_idx" ON "audience_segments"("isTemplate");

-- SegmentMembership table
CREATE TABLE IF NOT EXISTS "segment_memberships" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "segment_memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "segment_memberships_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "audience_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "segment_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "segment_memberships_segmentId_userId_key" ON "segment_memberships"("segmentId", "userId");
CREATE INDEX IF NOT EXISTS "segment_memberships_userId_idx" ON "segment_memberships"("userId");
CREATE INDEX IF NOT EXISTS "segment_memberships_segmentId_idx" ON "segment_memberships"("segmentId");

-- FK for marketing_journeys → audience_segments
ALTER TABLE "marketing_journeys" ADD CONSTRAINT "marketing_journeys_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "audience_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 3. SEGMENTATION MODULE — CORE SERVICE

### 3.1 File Structure

```
services/api/src/segmentation/
├── segmentation.module.ts
├── segmentation.service.ts
├── segmentation.service.spec.ts
├── segmentation-admin.controller.ts
├── segmentation-admin.controller.spec.ts
├── dto/
│   ├── create-segment.dto.ts
│   ├── update-segment.dto.ts
│   └── preview-segment.dto.ts
├── engines/
│   ├── rule-evaluator.ts               # Pure function: rules → Prisma where clause
│   └── rule-evaluator.spec.ts
└── jobs/
    ├── segment.jobs.ts                 # Refresh cron
    └── segment.jobs.spec.ts
```

### 3.2 SegmentationService

**File:** `services/api/src/segmentation/segmentation.service.ts`

```typescript
@Injectable()
export class SegmentationService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── CRUD ──

  async create(dto: CreateSegmentDto, createdBy: string): Promise<AudienceSegment>;
  // Generate slug from name (slugify + uniqueness check)
  // Validate rules against known dimensions (§4)
  // Create segment with memberCount: 0
  // Trigger immediate evaluation

  async update(id: string, dto: UpdateSegmentDto): Promise<AudienceSegment>;
  // Validate rules if changed
  // Re-evaluate if rules changed

  async archive(id: string): Promise<AudienceSegment>;
  // Set status = ARCHIVED
  // Delete all SegmentMembership rows for this segment

  async delete(id: string): Promise<void>;
  // Only ARCHIVED segments can be hard-deleted

  async findAll(filters: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AudienceSegment[]; total: number }>;

  async findById(id: string): Promise<AudienceSegment & { members: number }>;

  async findBySlug(slug: string): Promise<AudienceSegment>;

  // ── Evaluation ──

  async evaluateSegment(segmentId: string): Promise<{ added: number; removed: number; total: number }>;
  // 1. Load segment rules
  // 2. Build Prisma where clause via RuleEvaluator (§4)
  // 3. Query all matching userIds
  // 4. Diff against current SegmentMembership rows
  // 5. Insert new memberships, delete stale ones
  // 6. Update segment.memberCount + segment.lastEvaluatedAt
  // 7. Return delta stats

  async evaluateAllActive(): Promise<{ evaluated: number; errors: number }>;
  // Find all ACTIVE + DYNAMIC segments
  // Evaluate each one
  // Return aggregate stats

  async previewSegment(rules: SegmentRuleGroup): Promise<{ count: number; sampleUsers: PreviewUser[] }>;
  // Build where clause from rules
  // Count matching users
  // Return up to 10 sample users (id, email, firstName, tier, country)

  // ── Query ──

  async getSegmentMembers(segmentId: string, page?: number, limit?: number): Promise<{
    items: SegmentMember[];
    total: number;
  }>;
  // Paginated list of members with user + membership details

  async getUserSegments(userId: string): Promise<AudienceSegment[]>;
  // All segments a user belongs to

  async getSegmentUserIds(segmentId: string): Promise<string[]>;
  // Flat array of user IDs — used by broadcast and journey enrollment

  // ── lastActivityAt maintenance ──

  async touchActivity(userId: string): Promise<void>;
  // Update LoyaltyMembership.lastActivityAt = now()
  // Called from loyalty listener, event check-in, quiz completion, etc.
}
```

### 3.3 Module

**File:** `services/api/src/segmentation/segmentation.module.ts`

```typescript
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
  ],
  controllers: [SegmentationAdminController],
  providers: [SegmentationService, SegmentJobsService],
  exports: [SegmentationService],
})
export class SegmentationModule {}
```

**Wire into `app.module.ts`:**

```typescript
import { SegmentationModule } from './segmentation/segmentation.module';
// ...
@Module({
  imports: [
    // ... existing imports ...
    EventsModule,
    SegmentationModule,  // NEW
  ],
})
```

---

## 4. RULE DSL & FILTER ENGINE

### 4.1 Rule Schema (TypeScript types)

```typescript
// A segment is defined by a single SegmentRuleGroup
interface SegmentRuleGroup {
  operator: 'AND' | 'OR';      // How child rules/groups combine
  rules: SegmentRule[];         // Leaf filter conditions
  groups?: SegmentRuleGroup[];  // Nested sub-groups (allows AND-of-ORs, etc.)
}

interface SegmentRule {
  dimension: string;            // Which data field to filter on (see §4.2)
  operator: RuleOperator;       // Comparison operator
  value: unknown;               // The comparison value
}

type RuleOperator =
  | 'eq' | 'neq'               // equals / not equals
  | 'gt' | 'gte' | 'lt' | 'lte' // numeric / date comparisons
  | 'in' | 'not_in'            // array membership
  | 'contains' | 'not_contains' // string/array contains
  | 'is_empty' | 'is_not_empty' // null / empty checks
  | 'between'                  // range (value = [min, max])
  | 'days_ago_lt' | 'days_ago_gt'; // relative date (e.g. "last active < 30 days ago")
```

### 4.2 Supported Dimensions

Each dimension maps to a Prisma query path. The `RuleEvaluator` translates dimension + operator + value into a Prisma `where` fragment.

| Dimension | Source | Operators | Example |
|-----------|--------|-----------|---------|
| **Tier** | | | |
| `tier.slug` | `loyaltyMembership.tier.slug` | `eq`, `neq`, `in`, `not_in` | `{ dimension: "tier.slug", operator: "in", value: ["dragon-keeper", "archmage-circle"] }` |
| `tier.level` | `loyaltyMembership.tier.level` | `eq`, `gt`, `gte`, `lt`, `lte`, `between` | `{ dimension: "tier.level", operator: "gte", value: 4 }` |
| **Points & Spend** | | | |
| `points.balance` | `loyaltyMembership.currentBalance` | `gt`, `gte`, `lt`, `lte`, `between` | `{ dimension: "points.balance", operator: "gte", value: 500 }` |
| `points.lifetime` | `loyaltyMembership.totalPointsEarned` | `gt`, `gte`, `lt`, `lte`, `between` | |
| `spend.total` | `loyaltyMembership.totalSpend` | `gt`, `gte`, `lt`, `lte`, `between` | `{ dimension: "spend.total", operator: "gte", value: 100 }` |
| `purchase.count` | `loyaltyMembership.purchaseCount` | `gt`, `gte`, `lt`, `lte`, `between` | |
| `engagement.count` | `loyaltyMembership.engagementCount` | `gt`, `gte`, `lt`, `lte`, `between` | |
| `composite.score` | `loyaltyMembership.compositeScore` | `gt`, `gte`, `lt`, `lte`, `between` | |
| **Activity** | | | |
| `activity.lastAt` | `loyaltyMembership.lastActivityAt` | `days_ago_lt`, `days_ago_gt` | `{ dimension: "activity.lastAt", operator: "days_ago_gt", value: 60 }` — inactive > 60 days |
| `activity.enrolledAt` | `loyaltyMembership.enrolledAt` | `days_ago_lt`, `days_ago_gt`, `gt`, `lt` | `{ dimension: "activity.enrolledAt", operator: "days_ago_lt", value: 30 }` — enrolled < 30 days ago |
| `activity.lastLogin` | `user.lastLoginAt` | `days_ago_lt`, `days_ago_gt` | |
| **Geography** | | | |
| `geo.country` | `user.country` | `eq`, `neq`, `in`, `not_in` | `{ dimension: "geo.country", operator: "in", value: ["GB", "US"] }` |
| `geo.regionCode` | `loyaltyMembership.regionCode` | `eq`, `neq`, `in`, `not_in` | |
| `geo.city` | `user.addresses` (default address) | `eq`, `in` | Joins on Address where `isDefault: true` |
| **Fandom** | | | |
| `fandom.favorites` | `user.favoriteFandoms` | `contains`, `not_contains`, `is_empty`, `is_not_empty` | `{ dimension: "fandom.favorites", operator: "contains", value: "harry-potter" }` |
| `fandom.affinity` | `loyaltyMembership.fandomProfile` Json | custom JSONB query | `{ dimension: "fandom.affinity", operator: "gt", value: { fandom: "Harry Potter", score: 0.5 } }` |
| **Demographics** | | | |
| `user.role` | `user.role` | `eq`, `in` | `{ dimension: "user.role", operator: "eq", value: "CUSTOMER" }` |
| `user.birthday` | `user.birthday` OR `loyaltyMembership.birthday` | `is_empty`, `is_not_empty` | |
| `user.customerGroup` | `user.customerGroupId` | `eq`, `in`, `is_empty` | |
| **Enrollment** | | | |
| `enrollment.channel` | `loyaltyMembership.enrollmentChannel` | `eq`, `in` | `{ dimension: "enrollment.channel", operator: "eq", value: "POS" }` — signed up in-store |
| **Communication** | | | |
| `comms.optInEmail` | `loyaltyMembership.optInEmail` | `eq` | `{ dimension: "comms.optInEmail", operator: "eq", value: true }` |
| `comms.optInSms` | `loyaltyMembership.optInSms` | `eq` | |
| `comms.optInWhatsApp` | `loyaltyMembership.optInWhatsApp` | `eq` | |
| `comms.optInPush` | `loyaltyMembership.optInPush` | `eq` | |
| **Events** | | | |
| `events.attendanceCount` | `count(eventAttendances)` | `gt`, `gte`, `lt`, `lte`, `eq` | `{ dimension: "events.attendanceCount", operator: "gte", value: 3 }` |
| `events.hasAttended` | `exists(eventAttendances)` | `eq` (true/false) | |
| **Quiz** | | | |
| `quiz.completedCount` | `count(quizAttempts)` | `gt`, `gte`, `lt`, `lte` | |

### 4.3 RuleEvaluator

**File:** `services/api/src/segmentation/engines/rule-evaluator.ts`

```typescript
/**
 * Pure function: takes a SegmentRuleGroup and returns a Prisma UserWhereInput.
 * All dimensions resolve to paths on the User model (with relations).
 */
export function buildWhereClause(group: SegmentRuleGroup): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];

  for (const rule of group.rules) {
    conditions.push(dimensionToWhere(rule));
  }

  for (const sub of group.groups ?? []) {
    conditions.push(buildWhereClause(sub));
  }

  if (group.operator === 'AND') {
    return { AND: conditions };
  }
  return { OR: conditions };
}

function dimensionToWhere(rule: SegmentRule): Prisma.UserWhereInput {
  const { dimension, operator, value } = rule;

  switch (dimension) {
    case 'tier.slug':
      return { loyaltyMembership: { tier: { slug: applyOp(operator, value) } } };
    case 'tier.level':
      return { loyaltyMembership: { tier: { level: applyNumericOp(operator, value) } } };
    case 'points.balance':
      return { loyaltyMembership: { currentBalance: applyNumericOp(operator, value) } };
    case 'points.lifetime':
      return { loyaltyMembership: { totalPointsEarned: applyNumericOp(operator, value) } };
    case 'spend.total':
      return { loyaltyMembership: { totalSpend: applyNumericOp(operator, value) } };
    case 'purchase.count':
      return { loyaltyMembership: { purchaseCount: applyNumericOp(operator, value) } };
    case 'engagement.count':
      return { loyaltyMembership: { engagementCount: applyNumericOp(operator, value) } };
    case 'composite.score':
      return { loyaltyMembership: { compositeScore: applyNumericOp(operator, value) } };
    case 'activity.lastAt':
      return { loyaltyMembership: { lastActivityAt: applyDaysAgoOp(operator, value as number) } };
    case 'activity.enrolledAt':
      return { loyaltyMembership: { enrolledAt: applyDaysAgoOp(operator, value as number) } };
    case 'activity.lastLogin':
      return { lastLoginAt: applyDaysAgoOp(operator, value as number) };
    case 'geo.country':
      return { country: applyOp(operator, value) };
    case 'geo.regionCode':
      return { loyaltyMembership: { regionCode: applyOp(operator, value) } };
    case 'geo.city':
      return { addresses: { some: { isDefault: true, city: applyOp(operator, value) } } };
    case 'fandom.favorites':
      return applyArrayOp('favoriteFandoms', operator, value as string);
    case 'user.role':
      return { role: applyOp(operator, value) };
    case 'user.customerGroup':
      return { customerGroupId: applyOp(operator, value) };
    case 'enrollment.channel':
      return { loyaltyMembership: { enrollmentChannel: applyOp(operator, value) } };
    case 'comms.optInEmail':
      return { loyaltyMembership: { optInEmail: value as boolean } };
    case 'comms.optInSms':
      return { loyaltyMembership: { optInSms: value as boolean } };
    case 'comms.optInWhatsApp':
      return { loyaltyMembership: { optInWhatsApp: value as boolean } };
    case 'comms.optInPush':
      return { loyaltyMembership: { optInPush: value as boolean } };
    case 'events.attendanceCount':
      return { eventAttendances: applyCountOp(operator, value as number) };
    case 'events.hasAttended':
      return value ? { eventAttendances: { some: {} } } : { eventAttendances: { none: {} } };
    case 'quiz.completedCount':
      return { quizAttempts: applyCountOp(operator, value as number) };
    default:
      throw new Error(`Unknown segment dimension: ${dimension}`);
  }
}

// Helper: standard equality/inclusion operators → Prisma filter
function applyOp(op: RuleOperator, value: unknown): any { ... }

// Helper: numeric operators → Prisma { gt, gte, lt, lte }
function applyNumericOp(op: RuleOperator, value: unknown): any { ... }

// Helper: days_ago_lt / days_ago_gt → Date threshold
function applyDaysAgoOp(op: RuleOperator, days: number): any { ... }

// Helper: Prisma array has/hasEvery for String[] fields
function applyArrayOp(field: string, op: RuleOperator, value: string): Prisma.UserWhereInput { ... }

// Helper: relation count filter via Prisma _count
function applyCountOp(op: RuleOperator, count: number): any { ... }
```

**Important implementation notes:**
- All where clauses are rooted on `User` because `SegmentMembership` links to `User.id`
- The evaluator always includes `{ role: 'CUSTOMER', isActive: true, loyaltyMembership: { isNot: null } }` as a base filter — segments only contain active loyalty members
- `fandom.affinity` uses raw Prisma JSONB operators: `{ loyaltyMembership: { fandomProfile: { path: [fandomName], gte: score } } }`
- `events.attendanceCount` and `quiz.completedCount` use Prisma relation count filters

### 4.4 Rule Validation

`SegmentationService.validateRules(group: SegmentRuleGroup)`:
- Every `rule.dimension` must be in the known dimension list
- Every `rule.operator` must be valid for that dimension's type
- `value` must match expected type (number for numeric ops, string for string ops, boolean for boolean, etc.)
- Throw `BadRequestException` with specific error on invalid rules

---

## 5. DYNAMIC EVALUATION & MEMBERSHIP REFRESH

### 5.1 Refresh Strategy

| Trigger | What Happens |
|---------|-------------|
| Admin creates segment | Immediate evaluation |
| Admin updates segment rules | Immediate re-evaluation |
| Admin clicks "Refresh" | Immediate re-evaluation |
| Cron job (daily) | Evaluate ALL active dynamic segments |
| Admin triggers "Refresh All" | Evaluate all via job queue |

### 5.2 Evaluation Algorithm

```
1. Load segment.rules (SegmentRuleGroup)
2. Build Prisma where clause via buildWhereClause()
3. Add base filter: role = CUSTOMER, isActive = true, loyaltyMembership exists
4. SELECT id FROM users WHERE <computed clause>
5. Load current SegmentMembership rows for this segment
6. Compute diff:
   - newUserIds = matchedIds - currentMemberIds  → INSERT
   - staleUserIds = currentMemberIds - matchedIds → DELETE
7. Batch insert new SegmentMembership rows (chunked, 500 per batch)
8. Batch delete stale SegmentMembership rows
9. UPDATE segment SET memberCount = matchedIds.length, lastEvaluatedAt = NOW()
10. Return { added: newUserIds.length, removed: staleUserIds.length, total: matchedIds.length }
```

### 5.3 Segment Refresh Job

**File:** `services/api/src/segmentation/jobs/segment.jobs.ts`

```typescript
@Injectable()
export class SegmentJobsService implements OnModuleInit {
  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private segmentation: SegmentationService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.SEGMENT_REFRESH, async (job: Job) => {
      const segmentId = job.data?.segmentId;
      if (segmentId) {
        await this.segmentation.evaluateSegment(segmentId);
      }
    });

    this.queue.registerProcessor(JobType.SEGMENT_REFRESH_ALL, async () => {
      await this.segmentation.evaluateAllActive();
    });

    await this.queue.addRepeatable(
      JobType.SEGMENT_REFRESH_ALL,
      {},
      this.config.get<string>('SEGMENT_REFRESH_CRON', '0 3 * * *'), // Daily at 3 AM
    );
  }
}
```

### 5.4 Maintaining lastActivityAt

Update `LoyaltyMembership.lastActivityAt` whenever a member does something:

Hook into existing code by adding `SegmentationService.touchActivity(userId)` calls in:
- `LoyaltyWalletService.applyDelta` — after any EARN/BURN/BONUS transaction
- `EventsService.checkIn` — after attendance recorded
- `QuizService.submitQuiz` — after quiz completed
- `LoyaltyListener` — after review, social share, quest completion, referral

The `touchActivity` method is a single `UPDATE loyalty_memberships SET "lastActivityAt" = NOW() WHERE "userId" = $1`.

---

## 6. PRE-BUILT SEGMENT TEMPLATES

### 6.1 Template Definitions

Seed via `services/api/prisma/seeds/segment-seed.ts`:

| Template Slug | Name | Rules | Description |
|--------------|------|-------|-------------|
| `vip-at-risk` | VIP at risk | `tier.level >= 4 AND activity.lastAt days_ago_gt 30` | High-tier members inactive for 30+ days |
| `rising-stars` | Rising stars | `tier.level lte 2 AND purchase.count gte 3 AND activity.enrolledAt days_ago_lt 90` | New members with strong early engagement |
| `fandom-enthusiasts-hp` | Harry Potter enthusiasts | `fandom.favorites contains "harry-potter" AND engagement.count gte 5` | Engaged Harry Potter fans |
| `high-spenders` | High spenders | `spend.total gte 200 AND purchase.count gte 5` | Members with significant spend history |
| `inactive-members` | Inactive members | `activity.lastAt days_ago_gt 60 AND points.balance gt 0` | Dormant members with unspent points |
| `event-regulars` | Event regulars | `events.attendanceCount gte 3` | Members who attend events frequently |
| `in-store-signups` | In-store signups | `enrollment.channel eq "POS"` | Members who enrolled at a physical store |
| `tourists` | Tourist visitors | `geo.country not_in ["GB"] AND enrollment.channel eq "POS" AND purchase.count lte 2` | International customers who signed up in-store |

---

## 7. JOURNEY & BROADCAST INTEGRATION

### 7.1 Journey Segment Targeting

Enhance `MarketingJourney` to optionally reference an `AudienceSegment`:

When a journey has `segmentId` set, `matchesTriggerConditions` should also check that the user is a member of that segment:

**Modify `services/api/src/journeys/journey.service.ts` → `matchesTriggerConditions`:**

```typescript
async matchesTriggerConditions(
  journey: MarketingJourney,
  userId: string,
  _data?: Record<string, unknown>,
): Promise<boolean> {
  const cond = journey.triggerConditions as Record<string, unknown> | null;
  if (cond && Object.keys(cond).length > 0) {
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (typeof cond.tierSlug === 'string' && m?.tier.slug !== cond.tierSlug) return false;
    // NEW: check regionCodes
    if (journey.regionCodes?.length > 0 && m?.regionCode) {
      if (!journey.regionCodes.includes(m.regionCode)) return false;
    }
  }
  // NEW: check segment membership
  if (journey.segmentId) {
    const membership = await this.prisma.segmentMembership.findUnique({
      where: { segmentId_userId: { segmentId: journey.segmentId, userId } },
    });
    if (!membership) return false;
  }
  return true;
}
```

### 7.2 Enhanced Broadcast

Replace the primitive broadcast in `MessagingAdminController` with segment-aware broadcasting.

**Add to `SegmentationAdminController`:**

```typescript
@Post(':id/broadcast')
async broadcast(
  @Param('id') id: string,
  @Body() body: {
    channels: string[];
    templateSlug: string;
    subject?: string;
    templateVars?: Record<string, string>;
    limit?: number;
  },
): Promise<ApiResponse<unknown>> {
  // 1. Get segment user IDs
  // 2. Limit to body.limit (default 1000, max 5000)
  // 3. For each user, call MessagingService.send per channel
  // 4. Return { targeted, sent }
}
```

### 7.3 Segment-Targeted Event Invitations

The existing `EventsService.inviteToEvent` uses ad-hoc membership queries. Add an optional `segmentId` parameter:

**Modify `services/api/src/events/dto/invite-event.dto.ts`:**

```typescript
export class InviteEventDto {
  // ... existing fields ...
  @IsOptional() @IsString() segmentId?: string;
}
```

When `segmentId` is provided, use `SegmentationService.getSegmentUserIds(segmentId)` instead of building a custom membership query.

---

## 8. REST API ENDPOINTS (Admin)

### 8.1 Segmentation Admin Controller

**File:** `services/api/src/segmentation/segmentation-admin.controller.ts`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/segments` | List all segments (paginated, filterable by status/type) |
| `GET` | `/admin/segments/templates` | List pre-built template segments |
| `GET` | `/admin/segments/:id` | Get segment detail with member count |
| `POST` | `/admin/segments` | Create segment |
| `PATCH` | `/admin/segments/:id` | Update segment |
| `POST` | `/admin/segments/:id/archive` | Archive segment |
| `DELETE` | `/admin/segments/:id` | Delete archived segment |
| `POST` | `/admin/segments/:id/refresh` | Trigger segment re-evaluation |
| `POST` | `/admin/segments/refresh-all` | Trigger all segments re-evaluation |
| `POST` | `/admin/segments/preview` | Preview rules (returns count + sample users) |
| `GET` | `/admin/segments/:id/members` | List segment members (paginated) |
| `POST` | `/admin/segments/:id/broadcast` | Broadcast message to segment |
| `GET` | `/admin/segments/dimensions` | List available filter dimensions with operators |

---

## 9. ADMIN FRONTEND PAGES

### 9.1 Segments List — `apps/web/src/app/admin/segments/page.tsx`

- Table with columns: Name, Type, Status, Members, Last Evaluated
- Status filter pills: All / Active / Paused / Archived
- "Create Segment" button
- Row actions: View / Edit / Refresh / Archive
- Template segments highlighted with a badge

### 9.2 Segment Create/Edit — `apps/web/src/app/admin/segments/new/page.tsx` and `apps/web/src/app/admin/segments/[id]/edit/page.tsx`

- Name + description fields
- **Rule Builder UI:**
  - Visual AND/OR group containers (nestable)
  - Each rule row: dimension dropdown → operator dropdown → value input
  - Dimension dropdown grouped by category (Tier, Points, Activity, Geography, Fandom, etc.)
  - Operator dropdown filtered by selected dimension's type
  - Value input adapts: text input, number input, date picker, multi-select, boolean toggle
  - "Add rule" and "Add group" buttons
  - "Remove" button per rule/group
- Live preview: member count updates as rules change (debounced, calls preview endpoint)
- "Save" button

### 9.3 Segment Detail — `apps/web/src/app/admin/segments/[id]/page.tsx`

- Tabs: Overview | Members | Broadcast
- **Overview tab:**
  - Segment name, description, type, status
  - Rules displayed in human-readable format (e.g. "Tier level ≥ 4 AND Last active > 30 days ago")
  - Member count card + last evaluated timestamp
  - "Refresh Now" button
  - "Edit" / "Archive" buttons
- **Members tab:**
  - Paginated table: Name, Email, Tier, Points, Country, Joined Segment At
  - Search by name/email
- **Broadcast tab:**
  - Channel checkboxes (Email, SMS, WhatsApp, Push)
  - Template selector dropdown
  - Subject override
  - "Send to X members" button with confirmation modal

### 9.4 Admin Sidebar Update

**Modify `apps/web/src/components/AdminLayout.tsx`:**

Add to `menuItems` array (after Events section):

```typescript
{
  title: 'Audiences',
  icon: '🎯',
  children: [
    { title: 'Segments', href: '/admin/segments', icon: '👥' },
    { title: 'Create segment', href: '/admin/segments/new', icon: '➕' },
  ],
},
```

---

## 10. API CLIENT EXTENSIONS

**File:** `packages/api-client/src/client.ts`

Add the following methods:

```typescript
// ── Admin Segments ──
async adminListSegments(params?: {
  status?: string; type?: string; page?: number; limit?: number;
}): Promise<ApiResponse<unknown>>;

async adminGetSegment(id: string): Promise<ApiResponse<unknown>>;

async adminGetSegmentTemplates(): Promise<ApiResponse<unknown>>;

async adminCreateSegment(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;

async adminUpdateSegment(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;

async adminArchiveSegment(id: string): Promise<ApiResponse<unknown>>;

async adminDeleteSegment(id: string): Promise<ApiResponse<unknown>>;

async adminRefreshSegment(id: string): Promise<ApiResponse<unknown>>;

async adminRefreshAllSegments(): Promise<ApiResponse<unknown>>;

async adminPreviewSegment(body: { rules: unknown }): Promise<ApiResponse<unknown>>;

async adminGetSegmentMembers(id: string, params?: {
  page?: number; limit?: number;
}): Promise<ApiResponse<unknown>>;

async adminBroadcastToSegment(id: string, body: {
  channels: string[];
  templateSlug: string;
  subject?: string;
  templateVars?: Record<string, string>;
  limit?: number;
}): Promise<ApiResponse<unknown>>;

async adminGetSegmentDimensions(): Promise<ApiResponse<unknown>>;
```

---

## 11. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```typescript
interface EnvSchema {
  // ... existing ...
  SEGMENT_REFRESH_CRON?: string;         // Default: '0 3 * * *' (daily 3 AM)
  SEGMENT_EVAL_BATCH_SIZE?: string;      // Default: '500' (users per batch insert)
  SEGMENT_PREVIEW_LIMIT?: string;        // Default: '10' (sample users in preview)
  SEGMENT_BROADCAST_MAX?: string;        // Default: '5000' (max users per broadcast)
}
```

No external API keys required for Phase 6.

---

## 12. TESTING STRATEGY

### 12.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `segmentation/engines/rule-evaluator.spec.ts` | 12 | Every dimension + operator combo, nested AND/OR groups, unknown dimension throws, days_ago calculation, array operators, count operators |
| `segmentation/segmentation.service.spec.ts` | 10 | create, update, archive, delete (only archived), evaluateSegment (add/remove/no-change), previewSegment, getSegmentMembers, getUserSegments, validateRules (valid + invalid), touchActivity |
| `segmentation/segmentation-admin.controller.spec.ts` | 5 | list, create, refresh, preview, broadcast |
| `segmentation/jobs/segment.jobs.spec.ts` | 3 | SEGMENT_REFRESH processor, SEGMENT_REFRESH_ALL processor, cron scheduled |

**Total: ≥ 30 new tests**

### 12.2 Key Test Scenarios

1. **Tier filter:** Create segment with `tier.level gte 4`, evaluate → only Dragon Keeper+ members included
2. **Compound AND:** `tier.level gte 2 AND activity.lastAt days_ago_gt 30` → only inactive Spellcaster+ members
3. **Compound OR:** `geo.country eq "US" OR enrollment.channel eq "POS"` → US members + in-store signups
4. **Nested groups:** `(tier.level gte 4) AND (geo.country in ["GB"] OR geo.country in ["US"])` → VIP UK/US members
5. **Membership diff:** Evaluate segment, change rules, re-evaluate → verify members added/removed correctly
6. **Preview returns count:** Preview with rules → returns count + up to 10 sample users
7. **Invalid dimension rejected:** Create segment with unknown dimension → 400 error
8. **Archived segment can be deleted:** Archive → delete succeeds. Delete active → 400 error
9. **Journey segment gate:** Journey with segmentId, user not in segment → `matchesTriggerConditions` returns false
10. **lastActivityAt updated:** Call touchActivity → verify field updated on membership

### 12.3 Test Commands

```bash
npx jest --testPathPattern="segmentation" --no-cache --forceExit
```

---

## 13. MIGRATION & SEED SCRIPT

### 13.1 Migration

File: `services/api/prisma/migrations/20260601000000_phase6_segmentation_engine/migration.sql` (see §2.4)

### 13.2 Segment Seed

Create `services/api/prisma/seeds/segment-seed.ts`:

Seeds 8 template segments (see §6.1) using `upsert` by `templateSlug`.

```typescript
const templates = [
  {
    slug: 'vip-at-risk',
    name: 'VIP at risk',
    description: 'High-tier members inactive for 30+ days',
    templateSlug: 'vip-at-risk',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'gte', value: 4 },
        { dimension: 'activity.lastAt', operator: 'days_ago_gt', value: 30 },
      ],
    },
  },
  // ... 7 more templates from §6.1
];
```

Add to `services/api/package.json`:

```json
"db:seed-segments": "ts-node prisma/seeds/segment-seed.ts"
```

---

## 14. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Admin can create a segment with composable AND/OR rules | Create via admin API with nested rule groups |
| 2 | Segment evaluation correctly includes/excludes users | Create tier-filtered segment, verify only matching users |
| 3 | Membership diff works (add + remove on re-evaluate) | Change rules, refresh → verify members updated |
| 4 | Preview returns count + sample users without persisting | POST preview → verify response shape, no SegmentMembership rows created |
| 5 | Pre-built templates seeded and functional | Run seed → verify 8 template segments exist and evaluate |
| 6 | Daily cron refreshes all active dynamic segments | Verify SEGMENT_REFRESH_ALL job scheduled and executes |
| 7 | Admin can archive + delete segments | Archive → membership cleared. Delete archived → success. Delete active → 400 |
| 8 | Journey respects segment targeting | Journey with segmentId → only segment members enrolled |
| 9 | Journey regionCodes now enforced | Journey with regionCodes → non-matching region users excluded |
| 10 | Broadcast sends to segment members | POST broadcast → messages sent to segment members |
| 11 | lastActivityAt maintained | Earn points → verify lastActivityAt updated |
| 12 | Activity-based segments work | Create "inactive > 60 days" segment → verify correct users |
| 13 | Geography segments work | Create "country in GB" segment → verify correct users |
| 14 | Fandom segments work | Create "favorites contains harry-potter" → verify correct users |
| 15 | Event attendance segments work | Create "attendanceCount ≥ 3" → verify correct users |
| 16 | Segment member list is paginated | GET members → verify pagination response shape |
| 17 | Admin sidebar shows Audiences section | Verify "Audiences" with sub-links appears in AdminLayout |
| 18 | Admin UI: segment list page works | View list with status filters |
| 19 | Admin UI: segment builder works | Create segment with visual rule builder + live preview |
| 20 | Admin UI: segment detail has tabs | Overview / Members / Broadcast tabs functional |
| 21 | Invalid rules rejected with clear error | Submit unknown dimension → 400 with dimension name in message |
| 22 | ≥ 30 unit tests passing | `npx jest --testPathPattern="segmentation"` |
| 23 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 24 | Prisma schema validates | `npx prisma validate` |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (2 new models, LoyaltyMembership + MarketingJourney + User additions)
│   ├── migrations/
│   │   └── 20260601000000_phase6_segmentation_engine/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── segment-seed.ts                              # NEW
├── src/
│   ├── segmentation/
│   │   ├── segmentation.module.ts                       # NEW
│   │   ├── segmentation.service.ts                      # NEW
│   │   ├── segmentation.service.spec.ts                 # NEW
│   │   ├── segmentation-admin.controller.ts             # NEW
│   │   ├── segmentation-admin.controller.spec.ts        # NEW
│   │   ├── dto/
│   │   │   ├── create-segment.dto.ts                    # NEW
│   │   │   ├── update-segment.dto.ts                    # NEW
│   │   │   └── preview-segment.dto.ts                   # NEW
│   │   ├── engines/
│   │   │   ├── rule-evaluator.ts                        # NEW
│   │   │   └── rule-evaluator.spec.ts                   # NEW
│   │   └── jobs/
│   │       ├── segment.jobs.ts                          # NEW
│   │       └── segment.jobs.spec.ts                     # NEW
│   ├── journeys/
│   │   └── journey.service.ts                           # MODIFIED (matchesTriggerConditions: +segment + regionCode checks)
│   ├── events/
│   │   └── dto/
│   │       └── invite-event.dto.ts                      # MODIFIED (add segmentId field)
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (2 new job types)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (Phase 6 env vars)
│   └── app.module.ts                                    # MODIFIED (add SegmentationModule)
├── package.json                                         # MODIFIED (seed script)

apps/web/src/
├── app/
│   └── admin/
│       └── segments/
│           ├── page.tsx                                 # NEW — segment list
│           ├── new/
│           │   └── page.tsx                             # NEW — create segment (rule builder)
│           └── [id]/
│               ├── page.tsx                             # NEW — segment detail (tabs)
│               └── edit/
│                   └── page.tsx                         # NEW — edit segment
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — add Audiences section

packages/api-client/src/
└── client.ts                                            # MODIFIED (14 new segment methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add `AudienceSegment`, `SegmentMembership` models; add `lastActivityAt` to `LoyaltyMembership`; add `segmentId` to `MarketingJourney`; add `User.segmentMemberships` relation; run migration; regenerate Prisma
2. **JobType additions** — Add `SEGMENT_REFRESH` and `SEGMENT_REFRESH_ALL` to `queue.bullmq.impl.ts`
3. **RuleEvaluator engine** — Pure function `buildWhereClause` with all dimension handlers + helpers
4. **DTOs** — `CreateSegmentDto`, `UpdateSegmentDto`, `PreviewSegmentDto` with class-validator decorators
5. **SegmentationService** — CRUD, evaluateSegment, evaluateAllActive, previewSegment, touchActivity, member queries
6. **SegmentationAdminController** — All 13 admin endpoints
7. **SegmentationModule** — Wire module with imports (Database, Config, Queue)
8. **Segment jobs** — SEGMENT_REFRESH + SEGMENT_REFRESH_ALL processors and cron
9. **Wire to app** — Import `SegmentationModule` in `app.module.ts`
10. **Env vars** — Add Phase 6 env vars to `env.validation.ts`
11. **Journey integration** — Modify `matchesTriggerConditions` to check `segmentId` + `regionCodes`
12. **Event invite integration** — Add `segmentId` to `InviteEventDto`, wire in `EventsService.inviteToEvent`
13. **lastActivityAt hooks** — Add `touchActivity` calls in wallet, events, quiz, loyalty listener
14. **API Client** — Add 14 new methods to `packages/api-client/src/client.ts`
15. **Frontend (admin)** — Segment list, create/edit (rule builder), detail with tabs, sidebar update
16. **Seed script** — 8 template segments
17. **Unit tests** — ≥ 30 tests across 4 spec files
18. **Build verification** — `npx tsc --noEmit && npx jest --testPathPattern="segmentation" && npx prisma validate`

---

**End of Phase 6 Build Spec**
