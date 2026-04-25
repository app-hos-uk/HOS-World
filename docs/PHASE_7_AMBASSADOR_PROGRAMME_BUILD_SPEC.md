# Phase 7 — Ambassador Programme: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-7-ambassadors`  
**Base:** `feature/loyalty-phase-6-segmentation` (all Phase 1–6 work merged)  
**Estimated:** 3–4 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Ambassador Module — Core Service](#3-ambassador-module--core-service)
4. [Tier-Gated Unlock & Progression](#4-tier-gated-unlock--progression)
5. [UGC Submission & Rewards](#5-ugc-submission--rewards)
6. [Unified Referral Dashboard](#6-unified-referral-dashboard)
7. [Commission-as-Points Bridge](#7-commission-as-points-bridge)
8. [Ambassador Leaderboard & Achievements](#8-ambassador-leaderboard--achievements)
9. [Journey & Segment Integration](#9-journey--segment-integration)
10. [REST API Endpoints (Customer)](#10-rest-api-endpoints-customer)
11. [REST API Endpoints (Admin)](#11-rest-api-endpoints-admin)
12. [Frontend Pages (Customer)](#12-frontend-pages-customer)
13. [Frontend Pages (Admin)](#13-frontend-pages-admin)
14. [API Client Extensions](#14-api-client-extensions)
15. [Environment Variables](#15-environment-variables)
16. [Testing Strategy](#16-testing-strategy)
17. [Migration & Seed Script](#17-migration--seed-script)
18. [Acceptance Criteria](#18-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 7, confirm:

- [ ] Phase 1–6 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 190+ loyalty, POS, quiz, journey, messaging, event, and segmentation tests pass
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–6 services are functional:
  - `LoyaltyService` (enrollment, check-in, earn, redeem, preferences, referral info)
  - `LoyaltyWalletService` (applyDelta for EARN/BURN/BONUS with touchActivity)
  - `LoyaltyTierEngine` (recalculateTier — skips `inviteOnly` tiers)
  - `LoyaltyReferralService` (ensureReferralCode, code generation)
  - `LoyaltyListener` (onReviewSubmitted, onSocialShare, onQuestCompleted, onQuizCompleted, onUserRegistered referral conversion)
  - `SegmentationService` (create/evaluate segments, touchActivity)
  - `MessagingService` (consent-aware multi-channel send)
  - `MarketingEventBus` (emit + broadcast)
  - `JourneyService` (enrollment, processStep, matchesTriggerConditions with segmentId + regionCodes)
  - `EventsService` (RSVP, check-in, inviteToEvent with segmentId)
  - `GamificationService` (awardPoints → loyalty wallet bridge)
- [ ] The existing **influencer** system provides:
  - `Influencer` model (userId, referralCode, tier [BRONZE/SILVER/GOLD/PLATINUM], commission rates, storefront)
  - `Referral` model (influencer click → order conversion → commission)
  - `InfluencerCommission` + `InfluencerPayout` (sales-based commission lifecycle)
  - `InfluencerCampaign` (time-bound commission overrides)
  - `InfluencerCommissionRule` (per-product/category rate overrides)
  - `InfluencerStorefront` (themed landing page with featured products)
  - `InfluencerProductLink` (trackable product links with click/conversion counters)
- [ ] The existing **loyalty referral** system provides:
  - `LoyaltyReferral` model (referralCode, referrerPoints/refereePoints, status, convertedAt)
  - `LoyaltyReferralService.ensureReferralCode` (code generation)
  - `LoyaltyService.referralInfo` (code + shareUrl + stats: converted/pending/total/points earned)
  - `LoyaltyListener.onUserRegistered` (referral conversion → bonus points for both parties)
- [ ] Seeded tiers include:
  - Level 4: **Dragon Keeper** (7,500 pts, `inviteOnly: false`) — Ambassador unlock threshold
  - Level 5: **Archmage Circle** (15,000 pts, `inviteOnly: false`)
  - Level 6: **Council of Realms** (`inviteOnly: true`) — Top 1%, admin-assigned only
- [ ] Note: The two referral systems are **separate**: influencer referrals track sales commissions (money); loyalty referrals track signup bonuses (points). Phase 7 **unifies the dashboard view** but does NOT merge the underlying models.
- [ ] Note: `User.role` is the auth role (`CUSTOMER`, `ADMIN`, etc.). Ambassador status is NOT a role — it's a **programme status** on a new `AmbassadorProfile` model linked to the loyalty membership.

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**AmbassadorProfile — extends a loyalty member with ambassador capabilities:**

```prisma
model AmbassadorProfile {
  id                  String    @id @default(uuid())
  userId              String    @unique
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  membershipId        String    @unique
  membership          LoyaltyMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  status              String    @default("ACTIVE")       // ACTIVE, SUSPENDED, GRADUATED (→ Council of Realms)
  tier                String    @default("ADVOCATE")      // ADVOCATE, CHAMPION, LEGEND (ambassador-specific progression)
  referralCode        String    @unique                   // Dedicated ambassador referral code (separate from loyalty referral)
  displayName         String?
  bio                 String?   @db.Text
  profileImage        String?
  socialLinks         Json?                               // { instagram, tiktok, twitter, youtube, etc. }
  totalReferralSignups    Int   @default(0)               // Loyalty referral conversions
  totalReferralRevenue    Decimal @default(0) @db.Decimal(10, 2) // Revenue from referred orders
  totalUgcSubmissions     Int   @default(0)
  totalUgcApproved        Int   @default(0)
  totalPointsEarnedAsAmb  Int   @default(0)               // Points earned specifically from ambassador actions
  commissionAsPoints      Boolean @default(true)          // If true, influencer commissions convert to points at bonus rate
  commissionPointsRate    Decimal @default(1.5) @db.Decimal(3, 2)  // Points multiplier for commission conversion
  unlockedAt          DateTime  @default(now())
  lastActiveAt        DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  ugcSubmissions      UGCSubmission[]

  @@index([status])
  @@index([tier])
  @@index([userId])
  @@map("ambassador_profiles")
}
```

**UGCSubmission — user-generated content submitted by ambassadors for point rewards:**

```prisma
model UGCSubmission {
  id              String    @id @default(uuid())
  ambassadorId    String
  ambassador      AmbassadorProfile @relation(fields: [ambassadorId], references: [id], onDelete: Cascade)
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type            String                                  // PHOTO, VIDEO, REVIEW, STORY, UNBOXING, SOCIAL_POST
  title           String?
  description     String?   @db.Text
  mediaUrls       String[]  @default([])                  // URLs to uploaded images/videos
  socialUrl       String?                                 // Link to social media post (for verification)
  platform        String?                                 // INSTAGRAM, TIKTOK, YOUTUBE, TWITTER, OTHER
  productId       String?
  product         Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)
  fandomId        String?
  fandom          Fandom?   @relation(fields: [fandomId], references: [id], onDelete: SetNull)
  status          String    @default("PENDING")           // PENDING, APPROVED, REJECTED, FEATURED
  pointsAwarded   Int       @default(0)
  reviewedBy      String?
  reviewedAt      DateTime?
  reviewNotes     String?   @db.Text
  featuredAt      DateTime?                               // When promoted to "featured" status
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([ambassadorId])
  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([productId])
  @@map("ugc_submissions")
}
```

**AmbassadorAchievement — milestone badges earned by ambassadors:**

```prisma
model AmbassadorAchievement {
  id              String    @id @default(uuid())
  ambassadorId    String
  ambassador      AmbassadorProfile @relation(fields: [ambassadorId], references: [id], onDelete: Cascade)
  achievementSlug String                                  // e.g. "first-referral", "10-referrals", "ugc-star"
  name            String
  description     String?
  icon            String?
  pointsAwarded   Int       @default(0)
  unlockedAt      DateTime  @default(now())

  @@unique([ambassadorId, achievementSlug])
  @@index([ambassadorId])
  @@map("ambassador_achievements")
}
```

### 2.2 Model Additions

**Add to `User` model:**

```prisma
model User {
  // ... existing fields ...
  ambassadorProfile     AmbassadorProfile?
  ugcSubmissions        UGCSubmission[]
}
```

**Add to `LoyaltyMembership` model:**

```prisma
model LoyaltyMembership {
  // ... existing fields ...
  ambassadorProfile     AmbassadorProfile?
}
```

**Add to `Product` model:**

```prisma
model Product {
  // ... existing fields ...
  ugcSubmissions        UGCSubmission[]
}
```

**Add to `Fandom` model:**

```prisma
model Fandom {
  // ... existing fields ...
  ugcSubmissions        UGCSubmission[]
}
```

### 2.3 JobType Additions

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
export enum JobType {
  // ... existing values ...
  AMBASSADOR_TIER_REVIEW = 'ambassador:tier-review',
  AMBASSADOR_ACHIEVEMENT_CHECK = 'ambassador:achievement-check',
}
```

### 2.4 Manual Migration Script

Create `services/api/prisma/migrations/20260701000000_phase7_ambassador_programme/migration.sql`:

```sql
-- Phase 7: Ambassador Programme

-- AmbassadorProfile table
CREATE TABLE IF NOT EXISTS "ambassador_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tier" TEXT NOT NULL DEFAULT 'ADVOCATE',
    "referralCode" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "profileImage" TEXT,
    "socialLinks" JSONB,
    "totalReferralSignups" INTEGER NOT NULL DEFAULT 0,
    "totalReferralRevenue" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "totalUgcSubmissions" INTEGER NOT NULL DEFAULT 0,
    "totalUgcApproved" INTEGER NOT NULL DEFAULT 0,
    "totalPointsEarnedAsAmb" INTEGER NOT NULL DEFAULT 0,
    "commissionAsPoints" BOOLEAN NOT NULL DEFAULT true,
    "commissionPointsRate" DECIMAL(3, 2) NOT NULL DEFAULT 1.5,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ambassador_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ambassador_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ambassador_profiles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "loyalty_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_userId_key" ON "ambassador_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_membershipId_key" ON "ambassador_profiles"("membershipId");
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_referralCode_key" ON "ambassador_profiles"("referralCode");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_status_idx" ON "ambassador_profiles"("status");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_tier_idx" ON "ambassador_profiles"("tier");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_userId_idx" ON "ambassador_profiles"("userId");

-- UGCSubmission table
CREATE TABLE IF NOT EXISTS "ugc_submissions" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialUrl" TEXT,
    "platform" TEXT,
    "productId" TEXT,
    "fandomId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "featuredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ugc_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ugc_submissions_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "ambassador_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ugc_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ugc_submissions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ugc_submissions_fandomId_fkey" FOREIGN KEY ("fandomId") REFERENCES "fandoms"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ugc_submissions_ambassadorId_idx" ON "ugc_submissions"("ambassadorId");
CREATE INDEX IF NOT EXISTS "ugc_submissions_userId_idx" ON "ugc_submissions"("userId");
CREATE INDEX IF NOT EXISTS "ugc_submissions_status_idx" ON "ugc_submissions"("status");
CREATE INDEX IF NOT EXISTS "ugc_submissions_type_idx" ON "ugc_submissions"("type");
CREATE INDEX IF NOT EXISTS "ugc_submissions_productId_idx" ON "ugc_submissions"("productId");

-- AmbassadorAchievement table
CREATE TABLE IF NOT EXISTS "ambassador_achievements" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "achievementSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ambassador_achievements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ambassador_achievements_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "ambassador_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_achievements_ambassadorId_achievementSlug_key" ON "ambassador_achievements"("ambassadorId", "achievementSlug");
CREATE INDEX IF NOT EXISTS "ambassador_achievements_ambassadorId_idx" ON "ambassador_achievements"("ambassadorId");
```

---

## 3. AMBASSADOR MODULE — CORE SERVICE

### 3.1 File Structure

```
services/api/src/ambassador/
├── ambassador.module.ts
├── ambassador.service.ts
├── ambassador.service.spec.ts
├── ambassador.controller.ts                  # Customer-facing
├── ambassador.controller.spec.ts
├── ambassador-admin.controller.ts            # Admin
├── ambassador-admin.controller.spec.ts
├── dto/
│   ├── enroll-ambassador.dto.ts
│   ├── update-ambassador.dto.ts
│   ├── submit-ugc.dto.ts
│   └── review-ugc.dto.ts
├── engines/
│   ├── ambassador-tier.engine.ts             # ADVOCATE → CHAMPION → LEGEND progression
│   └── ambassador-tier.engine.spec.ts
├── jobs/
│   ├── ambassador.jobs.ts
│   └── ambassador.jobs.spec.ts
└── achievements/
    ├── achievement-definitions.ts            # Static achievement catalog
    └── achievement.service.ts
```

### 3.2 AmbassadorService

**File:** `services/api/src/ambassador/ambassador.service.ts`

```typescript
@Injectable()
export class AmbassadorService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wallet: LoyaltyWalletService,
    private tiers: LoyaltyTierEngine,
    private segmentation: SegmentationService,
    private achievementService: AmbassadorAchievementService,
  ) {}

  // ── Enrollment ──

  async enroll(userId: string, dto: EnrollAmbassadorDto): Promise<AmbassadorProfile>;
  // 1. Verify user has an active LoyaltyMembership
  // 2. Verify membership tier.level >= AMBASSADOR_MIN_TIER_LEVEL (default 4 = Dragon Keeper)
  // 3. Check no existing AmbassadorProfile for this user
  // 4. Generate unique ambassador referral code (AMB-{displayName}-{hex})
  // 5. Optionally link to existing Influencer profile if user has one
  // 6. Create AmbassadorProfile
  // 7. Award "ambassador-unlocked" achievement + bonus points
  // 8. Return profile

  async getProfile(userId: string): Promise<AmbassadorProfile & { achievements: AmbassadorAchievement[] }>;
  // Load profile with achievements, UGC stats

  async updateProfile(userId: string, dto: UpdateAmbassadorDto): Promise<AmbassadorProfile>;
  // Update displayName, bio, profileImage, socialLinks, commissionAsPoints preference

  async suspendAmbassador(userId: string, reason?: string): Promise<AmbassadorProfile>;
  // Admin action: set status = SUSPENDED

  async reactivateAmbassador(userId: string): Promise<AmbassadorProfile>;
  // Admin action: set status = ACTIVE

  // ── UGC ──

  async submitUgc(userId: string, dto: SubmitUgcDto): Promise<UGCSubmission>;
  // 1. Verify active AmbassadorProfile
  // 2. Validate UGC type and required fields
  // 3. Create UGCSubmission with status PENDING
  // 4. Increment ambassador.totalUgcSubmissions
  // 5. Check weekly UGC submission limit (AMBASSADOR_UGC_MAX_PER_WEEK, default 5)
  // 6. Return submission

  async reviewUgc(submissionId: string, dto: ReviewUgcDto, reviewerId: string): Promise<UGCSubmission>;
  // Admin action:
  // 1. Update status (APPROVED / REJECTED / FEATURED)
  // 2. If APPROVED: award points via LoyaltyWalletService, increment totalUgcApproved
  // 3. If FEATURED: set featuredAt, award bonus points
  // 4. Record reviewedBy, reviewedAt, reviewNotes
  // 5. Check for "ugc-star" achievement (10+ approved)
  // 6. Return updated submission

  async listUgc(ambassadorId: string, filters: {
    status?: string; type?: string; page?: number; limit?: number;
  }): Promise<{ items: UGCSubmission[]; total: number }>;

  async getFeaturedUgc(limit?: number): Promise<UGCSubmission[]>;
  // Public: featured UGC for display on storefront

  // ── Referral Dashboard ──

  async getReferralDashboard(userId: string): Promise<AmbassadorReferralDashboard>;
  // Unified view combining:
  // 1. Loyalty referrals (LoyaltyReferral): signups, points earned
  // 2. Influencer referrals (Referral + InfluencerCommission): if user has Influencer profile
  // 3. Ambassador-specific stats: totalReferralSignups, totalReferralRevenue
  // 4. Monthly trend (last 6 months)
  // 5. Recent referral activity feed

  async getLeaderboard(period: 'week' | 'month' | 'all', limit?: number): Promise<LeaderboardEntry[]>;
  // Rank ambassadors by ambassador points earned in period
  // Return: rank, displayName, profileImage, tier, points, referrals, ugcCount

  // ── Commission-as-Points ──

  async convertCommissionToPoints(userId: string, commissionId: string): Promise<{ pointsAwarded: number }>;
  // 1. Verify ambassador has commissionAsPoints enabled
  // 2. Load InfluencerCommission (must be APPROVED, not already converted)
  // 3. Calculate points: commission.amount × commissionPointsRate × 100
  // 4. Award via wallet (source: AMBASSADOR_COMMISSION, sourceId: commissionId)
  // 5. Mark commission with metadata { convertedToPoints: true, pointsAwarded }
  // 6. Return pointsAwarded

  // ── Tier Progression ──

  async checkTierProgression(ambassadorId: string): Promise<{ upgraded: boolean; newTier: string }>;
  // See §4 for tier rules

  // ── Admin ──

  async adminListAmbassadors(filters: {
    status?: string; tier?: string; page?: number; limit?: number; search?: string;
  }): Promise<{ items: AmbassadorProfile[]; total: number }>;

  async adminGetAmbassador(id: string): Promise<AmbassadorProfile & {
    user: User; membership: LoyaltyMembership; achievements: AmbassadorAchievement[];
    recentUgc: UGCSubmission[]; referralStats: object;
  }>;

  async adminDashboard(): Promise<AmbassadorDashboardStats>;
  // Total ambassadors, by tier, active this month, total UGC pending review,
  // total points awarded as ambassador, top referrers
}
```

### 3.3 Module

**File:** `services/api/src/ambassador/ambassador.module.ts`

```typescript
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
    LoyaltyModule,
    SegmentationModule,
  ],
  controllers: [AmbassadorController, AmbassadorAdminController],
  providers: [AmbassadorService, AmbassadorTierEngine, AmbassadorJobsService, AmbassadorAchievementService],
  exports: [AmbassadorService],
})
export class AmbassadorModule {}
```

**Wire into `app.module.ts`:**

```typescript
import { AmbassadorModule } from './ambassador/ambassador.module';
// ...
@Module({
  imports: [
    // ... existing imports ...
    SegmentationModule,
    AmbassadorModule,  // NEW
  ],
})
```

---

## 4. TIER-GATED UNLOCK & PROGRESSION

### 4.1 Ambassador Unlock

A customer can enroll as an ambassador when they reach **Dragon Keeper** tier (level 4) or higher. This is configurable via `AMBASSADOR_MIN_TIER_LEVEL` (default: `4`).

**Enrollment flow:**
1. Customer visits `/loyalty/ambassador` (or is prompted after tier upgrade to level 4+)
2. Frontend checks `GET /loyalty/ambassador/eligibility` — returns `{ eligible: true, currentTier, requiredTier }`
3. Customer fills out profile (display name, bio, social links) and submits
4. Backend creates `AmbassadorProfile`, generates referral code, awards welcome achievement

**Auto-prompt on tier upgrade:** When `LoyaltyEventService.onTierChange` fires an upgrade to level 4+, check if user already has an `AmbassadorProfile`. If not, include `ambassadorEligible: true` in the marketing bus event data so the welcome-to-ambassador journey can trigger.

### 4.2 Ambassador Tier Progression

Ambassadors have their own 3-tier progression within the programme (separate from the 6-tier loyalty progression):

| Ambassador Tier | Name | Requirement | Benefits |
|----------------|------|-------------|----------|
| 1 | **Advocate** | Enrolled (default) | UGC submissions, referral dashboard, base commission-to-points rate (1.5x) |
| 2 | **Champion** | 5+ referral signups AND 3+ approved UGC | Higher commission-to-points rate (2.0x), featured profile eligibility |
| 3 | **Legend** | 15+ referral signups AND 10+ approved UGC AND 1000+ ambassador points | Highest commission-to-points rate (2.5x), priority UGC featuring, "Legend" badge |

**File:** `services/api/src/ambassador/engines/ambassador-tier.engine.ts`

```typescript
export type AmbassadorTierSlug = 'ADVOCATE' | 'CHAMPION' | 'LEGEND';

export interface AmbassadorTierDef {
  slug: AmbassadorTierSlug;
  name: string;
  level: number;
  requirements: {
    minReferralSignups: number;
    minApprovedUgc: number;
    minAmbassadorPoints: number;
  };
  commissionPointsRate: number;   // Decimal multiplier
}

export const AMBASSADOR_TIERS: AmbassadorTierDef[] = [
  {
    slug: 'ADVOCATE',
    name: 'Advocate',
    level: 1,
    requirements: { minReferralSignups: 0, minApprovedUgc: 0, minAmbassadorPoints: 0 },
    commissionPointsRate: 1.5,
  },
  {
    slug: 'CHAMPION',
    name: 'Champion',
    level: 2,
    requirements: { minReferralSignups: 5, minApprovedUgc: 3, minAmbassadorPoints: 0 },
    commissionPointsRate: 2.0,
  },
  {
    slug: 'LEGEND',
    name: 'Legend',
    level: 3,
    requirements: { minReferralSignups: 15, minApprovedUgc: 10, minAmbassadorPoints: 1000 },
    commissionPointsRate: 2.5,
  },
];

export function evaluateAmbassadorTier(profile: {
  totalReferralSignups: number;
  totalUgcApproved: number;
  totalPointsEarnedAsAmb: number;
}): AmbassadorTierDef { ... }
// Returns the highest tier whose ALL requirements are met
```

### 4.3 Loyalty Tier Interaction

- Ambassador status does **NOT** affect loyalty tier. The 6-tier loyalty progression continues independently.
- If a member is demoted below Dragon Keeper (tier level < 4), their ambassador profile is **NOT** removed — it is set to `status: 'SUSPENDED'` with a note. They can reactivate when they return to the required tier.
- If a member reaches Council of Realms (level 6, invite-only), their ambassador status changes to `GRADUATED` — they retain all benefits plus Council-specific perks.

---

## 5. UGC SUBMISSION & REWARDS

### 5.1 UGC Types and Point Rewards

| UGC Type | Description | Base Points | Featured Bonus |
|----------|-------------|-------------|----------------|
| PHOTO | Product/store photo | 30 | +50 |
| VIDEO | Unboxing or product demo video | 75 | +100 |
| REVIEW | Extended product review (longer than standard reviews) | 40 | +50 |
| STORY | Personal fandom story | 50 | +75 |
| UNBOXING | Unboxing experience photo/video | 60 | +80 |
| SOCIAL_POST | Social media post with brand mention | 25 | +50 |

Points are configurable via `AMBASSADOR_UGC_POINTS_*` env vars (defaults above).

### 5.2 Submission Flow

1. Ambassador submits UGC via `POST /loyalty/ambassador/ugc` with type, title, description, media URLs, optional social URL
2. Status = `PENDING`; counter incremented
3. Admin reviews in `/admin/ambassadors/ugc` — approves, rejects, or features
4. On approval: points awarded to loyalty wallet (source: `AMBASSADOR_UGC`, sourceId: submission.id)
5. On featuring: additional bonus points + `featuredAt` set

### 5.3 Weekly Submission Limit

Configurable via `AMBASSADOR_UGC_MAX_PER_WEEK` (default: 5). Prevents spam while encouraging quality content.

---

## 6. UNIFIED REFERRAL DASHBOARD

### 6.1 Dashboard Data Shape

```typescript
interface AmbassadorReferralDashboard {
  // Loyalty referrals (signup bonuses)
  loyaltyReferrals: {
    total: number;
    converted: number;
    pending: number;
    totalPointsEarned: number;
    shareUrl: string;
    code: string;
  };
  // Influencer referrals (if user has Influencer profile)
  influencerReferrals: {
    available: boolean;       // true if user has Influencer profile
    totalClicks: number;
    totalConversions: number;
    totalSalesAmount: number;
    totalCommission: number;
    pendingCommission: number;
  } | null;
  // Ambassador aggregate stats
  ambassador: {
    totalReferralSignups: number;
    totalReferralRevenue: number;
    totalPointsEarnedAsAmb: number;
    tier: string;
    tierProgress: {
      current: AmbassadorTierDef;
      next: AmbassadorTierDef | null;
      progress: Record<string, { current: number; required: number }>;
    };
  };
  // Monthly trend (last 6 months)
  monthlyTrend: Array<{
    month: string;           // YYYY-MM
    signups: number;
    pointsEarned: number;
    ugcSubmitted: number;
  }>;
  // Recent activity feed (last 20 items)
  recentActivity: Array<{
    type: 'REFERRAL_SIGNUP' | 'UGC_APPROVED' | 'COMMISSION_CONVERTED' | 'ACHIEVEMENT_UNLOCKED' | 'TIER_UPGRADE';
    description: string;
    pointsEarned: number;
    date: string;
  }>;
}
```

### 6.2 Data Sources

- **Loyalty referrals:** `LoyaltyReferral` WHERE `referrerId` = ambassador's membershipId
- **Influencer referrals:** `Referral` + `InfluencerCommission` WHERE `influencer.userId` = ambassador's userId (only if `Influencer` record exists)
- **Monthly trend:** Aggregate `LoyaltyTransaction` WHERE source IN ('AMBASSADOR_UGC', 'AMBASSADOR_COMMISSION', 'REFERRAL_REWARD') + `LoyaltyReferral` conversions grouped by month

---

## 7. COMMISSION-AS-POINTS BRIDGE

### 7.1 How It Works

When an ambassador also has an `Influencer` profile (common for Dragon Keeper+ members), they can opt to receive influencer commissions as loyalty points instead of (or in addition to) cash payouts.

**Toggle:** `AmbassadorProfile.commissionAsPoints` (default: true)

**Conversion formula:**
```
pointsAwarded = floor(commission.amount × commissionPointsRate × 100)
```

Example: £10.00 commission × 1.5x rate × 100 = 1,500 points

### 7.2 Conversion Flow

1. Influencer commission reaches `APPROVED` status
2. If ambassador has `commissionAsPoints: true`:
   - System auto-converts OR ambassador manually triggers via dashboard
3. Points credited via `LoyaltyWalletService.applyDelta` with source `AMBASSADOR_COMMISSION`
4. Commission marked as `PAID` with metadata `{ convertedToPoints: true, pointsAwarded }`
5. Bypasses normal `InfluencerPayout` pipeline

### 7.3 Auto-Conversion (Optional)

If `AMBASSADOR_AUTO_CONVERT_COMMISSION` is `true` (default: `false`), commissions are automatically converted to points when approved. Otherwise, ambassadors click "Convert to Points" in their dashboard.

---

## 8. AMBASSADOR LEADERBOARD & ACHIEVEMENTS

### 8.1 Achievement Definitions

**File:** `services/api/src/ambassador/achievements/achievement-definitions.ts`

| Slug | Name | Trigger | Points |
|------|------|---------|--------|
| `ambassador-unlocked` | Ambassador Unlocked | Enroll as ambassador | 200 |
| `first-referral` | First Referral | First loyalty referral converted | 100 |
| `referral-5` | Referral Pro | 5 referral signups | 250 |
| `referral-15` | Referral Legend | 15 referral signups | 500 |
| `referral-50` | Referral Master | 50 referral signups | 1000 |
| `ugc-first` | Content Creator | First UGC approved | 100 |
| `ugc-star` | UGC Star | 10 UGC approved | 300 |
| `ugc-featured` | Featured Creator | First UGC featured | 200 |
| `champion-tier` | Champion Achiever | Reach Champion tier | 500 |
| `legend-tier` | Legendary Ambassador | Reach Legend tier | 1000 |
| `points-1000` | Points Millionaire | Earn 1000+ ambassador points | 200 |
| `social-butterfly` | Social Butterfly | Submit UGC from 3+ different platforms | 150 |

### 8.2 Achievement Check Logic

After any ambassador action (referral conversion, UGC approval, tier change), call `AmbassadorAchievementService.checkAndAward(ambassadorId)`:
- Load profile stats
- Compare against all achievement definitions
- For each unearned achievement whose condition is met → create `AmbassadorAchievement` row + award points

### 8.3 Leaderboard

Ranked by `totalPointsEarnedAsAmb` within a time window:
- **Weekly:** Points earned this ISO week
- **Monthly:** Points earned this calendar month
- **All-time:** `totalPointsEarnedAsAmb` on profile

Leaderboard is public for ambassadors (shows rank, display name, tier).

---

## 9. JOURNEY & SEGMENT INTEGRATION

### 9.1 New Segment Dimensions

Add to `services/api/src/segmentation/engines/rule-evaluator.ts` SEGMENT_DIMENSIONS:

| Dimension | Source | Operators |
|-----------|--------|-----------|
| `ambassador.status` | `ambassadorProfile.status` | `eq`, `in` |
| `ambassador.tier` | `ambassadorProfile.tier` | `eq`, `in` |
| `ambassador.referralSignups` | `ambassadorProfile.totalReferralSignups` | `gt`, `gte`, `lt`, `lte`, `between` |
| `ambassador.ugcApproved` | `ambassadorProfile.totalUgcApproved` | `gt`, `gte`, `lt`, `lte`, `between` |
| `ambassador.isAmbassador` | `ambassadorProfile IS NOT NULL` | `eq` (true/false) |

### 9.2 Marketing Journey Triggers

New trigger events for `MarketingEventBus.emit`:

| Event | When | Data |
|-------|------|------|
| `AMBASSADOR_ENROLLED` | Ambassador profile created | `{ userId, displayName, tier }` |
| `AMBASSADOR_TIER_UPGRADE` | Ambassador tier promoted | `{ userId, oldTier, newTier }` |
| `AMBASSADOR_UGC_APPROVED` | UGC submission approved | `{ userId, ugcType, pointsAwarded }` |
| `AMBASSADOR_UGC_FEATURED` | UGC submission featured | `{ userId, ugcType, title }` |
| `AMBASSADOR_ACHIEVEMENT` | Achievement unlocked | `{ userId, achievementSlug, achievementName }` |

### 9.3 Pre-Built Journey (Seed)

Seed a "welcome-ambassador" journey:
- Trigger: `AMBASSADOR_ENROLLED`
- Steps: SEND welcome email → WAIT 3 days → SEND "submit your first UGC" prompt → WAIT 7 days → CONDITION (has UGC?) → SEND "great job" or "we'd love to see your content"

---

## 10. REST API ENDPOINTS (Customer)

### 10.1 Ambassador Controller

**File:** `services/api/src/ambassador/ambassador.controller.ts`

Base path: `/loyalty/ambassador`  
Guards: `JwtAuthGuard`, `RolesGuard`, role `CUSTOMER`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/loyalty/ambassador/eligibility` | Check if user can enroll (tier check) |
| `POST` | `/loyalty/ambassador/enroll` | Enroll as ambassador |
| `GET` | `/loyalty/ambassador/profile` | Get ambassador profile + achievements |
| `PATCH` | `/loyalty/ambassador/profile` | Update profile (bio, social links, etc.) |
| `POST` | `/loyalty/ambassador/ugc` | Submit UGC |
| `GET` | `/loyalty/ambassador/ugc` | List own UGC submissions |
| `GET` | `/loyalty/ambassador/dashboard` | Unified referral dashboard |
| `GET` | `/loyalty/ambassador/leaderboard` | Ambassador leaderboard |
| `GET` | `/loyalty/ambassador/achievements` | Own achievements |
| `POST` | `/loyalty/ambassador/convert-commission/:commissionId` | Convert commission to points |

---

## 11. REST API ENDPOINTS (Admin)

### 11.1 Ambassador Admin Controller

**File:** `services/api/src/ambassador/ambassador-admin.controller.ts`

Base path: `/admin/ambassadors`  
Guards: `JwtAuthGuard`, `RolesGuard`, role `ADMIN`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/ambassadors` | List ambassadors (paginated, filterable) |
| `GET` | `/admin/ambassadors/dashboard` | Programme KPIs |
| `GET` | `/admin/ambassadors/:id` | Ambassador detail |
| `POST` | `/admin/ambassadors/:id/suspend` | Suspend ambassador |
| `POST` | `/admin/ambassadors/:id/reactivate` | Reactivate ambassador |
| `GET` | `/admin/ambassadors/ugc` | List all UGC (paginated, filterable by status) |
| `POST` | `/admin/ambassadors/ugc/:id/review` | Review UGC (approve/reject/feature) |
| `GET` | `/admin/ambassadors/leaderboard` | Admin view of leaderboard |

---

## 12. FRONTEND PAGES (Customer)

### 12.1 Ambassador Hub — `apps/web/src/app/loyalty/ambassador/page.tsx`

- If not enrolled: show eligibility check + enrollment form
- If enrolled: tabs for Dashboard / UGC / Leaderboard / Achievements
- **Dashboard tab:** Referral stats cards, share link, monthly trend chart, activity feed
- **UGC tab:** Submit form + list of past submissions with status
- **Leaderboard tab:** Weekly/monthly/all-time toggle, ranked list
- **Achievements tab:** Grid of achievement cards (earned vs locked)

### 12.2 Ambassador Profile Edit — `apps/web/src/app/loyalty/ambassador/profile/page.tsx`

- Edit display name, bio, profile image, social links
- Toggle commission-as-points preference
- View ambassador tier and progress to next tier

---

## 13. FRONTEND PAGES (Admin)

### 13.1 Ambassador List — `apps/web/src/app/admin/ambassadors/page.tsx`

- Table: Name, Tier, Status, Referrals, UGC (approved/pending), Points, Actions
- Filters: status, tier, search
- Row actions: View / Suspend / Reactivate

### 13.2 Ambassador Detail — `apps/web/src/app/admin/ambassadors/[id]/page.tsx`

- Profile overview, tier, achievements
- Referral stats (loyalty + influencer)
- Recent UGC submissions
- Action buttons: Suspend / Reactivate

### 13.3 UGC Review — `apps/web/src/app/admin/ambassadors/ugc/page.tsx`

- Table of pending UGC submissions
- Status filter pills: Pending / Approved / Rejected / Featured
- Inline review: preview media, approve/reject/feature buttons
- Approve modal: confirm points to award

### 13.4 Admin Sidebar Update

**Modify `apps/web/src/components/AdminLayout.tsx`:**

Add to `menuItems` array (after Audiences section):

```typescript
{
  title: 'Ambassadors',
  icon: '🌟',
  children: [
    { title: 'All ambassadors', href: '/admin/ambassadors', icon: '👑' },
    { title: 'UGC review', href: '/admin/ambassadors/ugc', icon: '📸' },
    { title: 'Dashboard', href: '/admin/ambassadors/dashboard', icon: '📊' },
  ],
},
```

---

## 14. API CLIENT EXTENSIONS

**File:** `packages/api-client/src/client.ts`

Add the following methods:

```typescript
// ── Ambassador (Customer) ──
async getAmbassadorEligibility(): Promise<ApiResponse<unknown>>;
async enrollAmbassador(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async getAmbassadorProfile(): Promise<ApiResponse<unknown>>;
async updateAmbassadorProfile(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async submitAmbassadorUgc(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async listAmbassadorUgc(params?: { status?: string; page?: number; limit?: number }): Promise<ApiResponse<unknown>>;
async getAmbassadorDashboard(): Promise<ApiResponse<unknown>>;
async getAmbassadorLeaderboard(params?: { period?: string; limit?: number }): Promise<ApiResponse<unknown>>;
async getAmbassadorAchievements(): Promise<ApiResponse<unknown>>;
async convertAmbassadorCommission(commissionId: string): Promise<ApiResponse<unknown>>;

// ── Ambassador (Admin) ──
async adminListAmbassadors(params?: { status?: string; tier?: string; page?: number; limit?: number; search?: string }): Promise<ApiResponse<unknown>>;
async adminGetAmbassadorDashboard(): Promise<ApiResponse<unknown>>;
async adminGetAmbassador(id: string): Promise<ApiResponse<unknown>>;
async adminSuspendAmbassador(id: string): Promise<ApiResponse<unknown>>;
async adminReactivateAmbassador(id: string): Promise<ApiResponse<unknown>>;
async adminListAmbassadorUgc(params?: { status?: string; type?: string; page?: number; limit?: number }): Promise<ApiResponse<unknown>>;
async adminReviewAmbassadorUgc(id: string, body: { status: string; reviewNotes?: string }): Promise<ApiResponse<unknown>>;
async adminGetAmbassadorLeaderboard(params?: { period?: string; limit?: number }): Promise<ApiResponse<unknown>>;
```

**Total: 18 new methods**

---

## 15. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```typescript
interface EnvSchema {
  // ... existing ...
  AMBASSADOR_MIN_TIER_LEVEL?: string;                  // Default: '4' (Dragon Keeper)
  AMBASSADOR_UGC_MAX_PER_WEEK?: string;                // Default: '5'
  AMBASSADOR_UGC_POINTS_PHOTO?: string;                // Default: '30'
  AMBASSADOR_UGC_POINTS_VIDEO?: string;                // Default: '75'
  AMBASSADOR_UGC_POINTS_REVIEW?: string;               // Default: '40'
  AMBASSADOR_UGC_POINTS_STORY?: string;                // Default: '50'
  AMBASSADOR_UGC_POINTS_UNBOXING?: string;             // Default: '60'
  AMBASSADOR_UGC_POINTS_SOCIAL_POST?: string;          // Default: '25'
  AMBASSADOR_UGC_FEATURED_BONUS?: string;              // Default: '50' (additional points for FEATURED)
  AMBASSADOR_AUTO_CONVERT_COMMISSION?: string;         // Default: 'false'
  AMBASSADOR_ENROLL_BONUS_POINTS?: string;             // Default: '200'
  AMBASSADOR_TIER_REVIEW_CRON?: string;                // Default: '0 4 * * *' (daily 4 AM)
}
```

No external API keys required for Phase 7.

---

## 16. TESTING STRATEGY

### 16.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `ambassador/engines/ambassador-tier.engine.spec.ts` | 5 | All 3 tiers, progression, regression, edge (zero stats) |
| `ambassador/ambassador.service.spec.ts` | 12 | enroll (eligible + ineligible), getProfile, updateProfile, submitUgc (+ weekly limit), reviewUgc (approve/reject/feature), getReferralDashboard, convertCommissionToPoints, checkTierProgression, suspendAmbassador, adminListAmbassadors |
| `ambassador/ambassador.controller.spec.ts` | 5 | eligibility, enroll, profile, ugc submit, dashboard |
| `ambassador/ambassador-admin.controller.spec.ts` | 5 | list, detail, suspend/reactivate, ugc review, leaderboard |
| `ambassador/jobs/ambassador.jobs.spec.ts` | 3 | tier review processor, achievement check processor, cron scheduled |

**Total: ≥ 30 new tests**

### 16.2 Key Test Scenarios

1. **Tier gate:** User at level 3 (Enchanter) cannot enroll → 403/400 error
2. **Tier gate:** User at level 4 (Dragon Keeper) can enroll → AmbassadorProfile created
3. **Duplicate prevention:** Already enrolled user cannot re-enroll → ConflictException
4. **UGC submission limit:** 6th submission in a week → BadRequestException
5. **UGC approval awards points:** Approve UGC → wallet transaction created, balance updated
6. **UGC featured bonus:** Feature UGC → base + bonus points awarded
7. **Ambassador tier upgrade:** 5 referrals + 3 approved UGC → ADVOCATE → CHAMPION
8. **Commission conversion:** £10 commission × 1.5x × 100 = 1,500 points
9. **Referral dashboard:** Combines loyalty + influencer data correctly
10. **Achievement unlocked:** First referral → "first-referral" achievement + points

### 16.3 Test Commands

```bash
npx jest --testPathPattern="ambassador" --no-cache --forceExit
```

---

## 17. MIGRATION & SEED SCRIPT

### 17.1 Migration

File: `services/api/prisma/migrations/20260701000000_phase7_ambassador_programme/migration.sql` (see §2.4)

### 17.2 Ambassador Seed

Create `services/api/prisma/seeds/ambassador-seed.ts`:

Seeds the "welcome-ambassador" journey template using `upsert` by slug.

Add to `services/api/package.json`:

```json
"db:seed-ambassadors": "ts-node prisma/seeds/ambassador-seed.ts"
```

---

## 18. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Dragon Keeper+ members can enroll as ambassadors | Enroll via API with tier 4+ membership |
| 2 | Sub-Dragon Keeper members are rejected | Attempt enroll at tier 3 → 400 error |
| 3 | Ambassador profile stores display name, bio, social links | GET profile returns all fields |
| 4 | UGC can be submitted with type, media, social link | POST UGC → submission created with PENDING status |
| 5 | Weekly UGC limit enforced | Submit 6th in a week → 400 error |
| 6 | Admin can approve UGC and points are awarded | Approve → wallet transaction, balance updated |
| 7 | Admin can feature UGC with bonus points | Feature → base + bonus points, featuredAt set |
| 8 | Admin can reject UGC with notes | Reject → status REJECTED, no points |
| 9 | Referral dashboard shows loyalty referral stats | Dashboard includes signups, pending, points |
| 10 | Referral dashboard shows influencer stats if applicable | If user has Influencer profile → shows clicks, sales |
| 11 | Commission-to-points conversion works | Convert £10 commission → 1500 points (1.5x × 100) |
| 12 | Ambassador tier progression works (ADVOCATE → CHAMPION) | Meet requirements → tier upgraded |
| 13 | Ambassador tier progression works (CHAMPION → LEGEND) | Meet Legend requirements → tier upgraded |
| 14 | Achievements unlock automatically | First referral → "first-referral" achievement created |
| 15 | Leaderboard ranks by ambassador points | GET leaderboard → sorted by points, period filter |
| 16 | Suspended ambassador cannot submit UGC | Suspend → submit → 403 error |
| 17 | Tier demotion below level 4 suspends ambassador | Recalculate tier → level < 4 → status SUSPENDED |
| 18 | Admin dashboard shows programme KPIs | GET dashboard → total ambassadors, by tier, pending UGC |
| 19 | Admin sidebar shows Ambassadors section | Verify menu items in AdminLayout |
| 20 | Customer ambassador hub shows all tabs | Dashboard, UGC, Leaderboard, Achievements |
| 21 | Segment dimension `ambassador.isAmbassador` works | Create segment with dimension → correct users |
| 22 | Marketing journey triggers on AMBASSADOR_ENROLLED | Enroll → journey enrolled if configured |
| 23 | ≥ 30 unit tests passing | `npx jest --testPathPattern="ambassador"` |
| 24 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 25 | Prisma schema validates | `npx prisma validate` |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (3 new models + relation additions)
│   ├── migrations/
│   │   └── 20260701000000_phase7_ambassador_programme/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── ambassador-seed.ts                           # NEW
├── src/
│   ├── ambassador/
│   │   ├── ambassador.module.ts                         # NEW
│   │   ├── ambassador.service.ts                        # NEW
│   │   ├── ambassador.service.spec.ts                   # NEW
│   │   ├── ambassador.controller.ts                     # NEW (customer-facing)
│   │   ├── ambassador.controller.spec.ts                # NEW
│   │   ├── ambassador-admin.controller.ts               # NEW
│   │   ├── ambassador-admin.controller.spec.ts          # NEW
│   │   ├── dto/
│   │   │   ├── enroll-ambassador.dto.ts                 # NEW
│   │   │   ├── update-ambassador.dto.ts                 # NEW
│   │   │   ├── submit-ugc.dto.ts                        # NEW
│   │   │   └── review-ugc.dto.ts                        # NEW
│   │   ├── engines/
│   │   │   ├── ambassador-tier.engine.ts                # NEW
│   │   │   └── ambassador-tier.engine.spec.ts           # NEW
│   │   ├── jobs/
│   │   │   ├── ambassador.jobs.ts                       # NEW
│   │   │   └── ambassador.jobs.spec.ts                  # NEW
│   │   └── achievements/
│   │       ├── achievement-definitions.ts               # NEW
│   │       └── achievement.service.ts                   # NEW
│   ├── segmentation/
│   │   └── engines/
│   │       └── rule-evaluator.ts                        # MODIFIED (5 new ambassador dimensions)
│   ├── loyalty/
│   │   └── services/
│   │       └── loyalty-event.service.ts                 # MODIFIED (ambassadorEligible in tier upgrade event)
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (2 new job types)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (Phase 7 env vars)
│   └── app.module.ts                                    # MODIFIED (add AmbassadorModule)
├── package.json                                         # MODIFIED (seed script)

apps/web/src/
├── app/
│   ├── loyalty/
│   │   └── ambassador/
│   │       ├── page.tsx                                 # NEW — ambassador hub (dashboard/UGC/leaderboard/achievements)
│   │       └── profile/
│   │           └── page.tsx                             # NEW — profile edit
│   └── admin/
│       └── ambassadors/
│           ├── page.tsx                                 # NEW — ambassador list
│           ├── [id]/
│           │   └── page.tsx                             # NEW — ambassador detail
│           ├── ugc/
│           │   └── page.tsx                             # NEW — UGC review queue
│           └── dashboard/
│               └── page.tsx                             # NEW — programme KPIs (optional: inline in list)
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — add Ambassadors section

packages/api-client/src/
└── client.ts                                            # MODIFIED (18 new ambassador methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add `AmbassadorProfile`, `UGCSubmission`, `AmbassadorAchievement` models; add relations to `User`, `LoyaltyMembership`, `Product`, `Fandom`; run migration; regenerate Prisma
2. **JobType additions** — Add `AMBASSADOR_TIER_REVIEW` and `AMBASSADOR_ACHIEVEMENT_CHECK` to `queue.bullmq.impl.ts`
3. **Ambassador tier engine** — Pure function `evaluateAmbassadorTier` + tier definitions
4. **Achievement definitions** — Static catalog of 12 achievements
5. **Achievement service** — `checkAndAward(ambassadorId)` logic
6. **DTOs** — `EnrollAmbassadorDto`, `UpdateAmbassadorDto`, `SubmitUgcDto`, `ReviewUgcDto` with class-validator decorators
7. **AmbassadorService** — Enrollment, UGC CRUD, referral dashboard, commission conversion, tier progression, admin methods
8. **AmbassadorController** — 10 customer-facing endpoints
9. **AmbassadorAdminController** — 8 admin endpoints
10. **AmbassadorModule** — Wire module with imports (Database, Config, Queue, Loyalty, Segmentation)
11. **Ambassador jobs** — `AMBASSADOR_TIER_REVIEW` processor (daily cron) + `AMBASSADOR_ACHIEVEMENT_CHECK` processor
12. **Wire to app** — Import `AmbassadorModule` in `app.module.ts`
13. **Env vars** — Add Phase 7 env vars to `env.validation.ts`
14. **Segment dimensions** — Add 5 ambassador dimensions to `rule-evaluator.ts`
15. **Loyalty event integration** — Emit `ambassadorEligible` in tier upgrade event; add `AMBASSADOR_*` marketing events
16. **API Client** — Add 18 new methods to `packages/api-client/src/client.ts`
17. **Frontend (customer)** — Ambassador hub page (4 tabs) + profile edit
18. **Frontend (admin)** — Ambassador list, detail, UGC review, dashboard, sidebar update
19. **Seed script** — Welcome-ambassador journey template
20. **Unit tests** — ≥ 30 tests across 5 spec files
21. **Build verification** — `npx tsc --noEmit && npx jest --testPathPattern="ambassador" && npx prisma validate`

---

**End of Phase 7 Build Spec**
