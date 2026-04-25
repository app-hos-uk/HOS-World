# Phase 8 — Brand Partnership Module: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-8-brand-partnerships`  
**Base:** `feature/loyalty-phase-1` (all Phase 1–7 work committed)  
**Estimated:** 3–4 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Brand Partnership Module — Core Service](#3-brand-partnership-module--core-service)
4. [Campaign Types & Funding Model](#4-campaign-types--funding-model)
5. [Points Multiplier & Bonus Logic](#5-points-multiplier--bonus-logic)
6. [Sponsored Products & Tier Exclusives](#6-sponsored-products--tier-exclusives)
7. [Segment Targeting Integration](#7-segment-targeting-integration)
8. [Partner Reporting & Analytics](#8-partner-reporting--analytics)
9. [Journey & Marketing Integration](#9-journey--marketing-integration)
10. [REST API Endpoints (Admin)](#10-rest-api-endpoints-admin)
11. [REST API Endpoints (Customer-Facing)](#11-rest-api-endpoints-customer-facing)
12. [Frontend Pages (Admin)](#12-frontend-pages-admin)
13. [Frontend Pages (Customer)](#13-frontend-pages-customer)
14. [API Client Extensions](#14-api-client-extensions)
15. [Environment Variables](#15-environment-variables)
16. [Testing Strategy](#16-testing-strategy)
17. [Migration & Seed Script](#17-migration--seed-script)
18. [Acceptance Criteria](#18-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 8, confirm:

- [ ] Phase 1–7 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 200+ loyalty, POS, quiz, journey, messaging, event, segmentation, and ambassador tests pass
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–7 services are functional:
  - `LoyaltyService` (enrollment, earn, redeem, tiers, referrals)
  - `LoyaltyWalletService` (applyDelta for EARN/BURN/BONUS with touchActivity)
  - `LoyaltyEarnEngine` (processOrderComplete — tier multiplier × earn rule × campaign bonus)
  - `LoyaltyCampaignService` (getActiveForContext, applyCampaignsToBasePoints)
  - `LoyaltyBonusCampaign` model (multiplier, bonusPoints, regionCodes, channelCodes, date range)
  - `SegmentationService` (create/evaluate segments, getSegmentUserIds)
  - `MarketingEventBus` (emit + broadcast)
  - `JourneyService` (enrollment, processStep, matchesTriggerConditions with segmentId)
  - `MessagingService` (consent-aware multi-channel send)
  - `AmbassadorService` (enroll, UGC, referral dashboard)
- [ ] The existing **product** system provides:
  - `Product` model with `fandom` (String?), `brand` (String?), `categoryId` (String?)
  - `Product.seller` relation and `Seller.loyaltyEnabled`, `Seller.loyaltyEarnRate`
- [ ] The existing **earn engine** flow is:
  1. `processOrderComplete` → per-item base points (seller earn rate or platform default)
  2. `LoyaltyCampaignService.getActiveForContext(regionCode, channel)` returns `LoyaltyBonusCampaign[]`
  3. `applyCampaignsToBasePoints(campaigns, basePoints)` → best multiplier + sum bonuses
  4. Tier multiplier applied on top
  5. Result → `wallet.applyDelta` with `campaignId` on transaction
- [ ] Note: `LoyaltyBonusCampaign` is the existing campaign model. Phase 8 introduces a **`BrandPartnership`** entity that *owns* campaigns, adding brand-level tracking, budget, and reporting on top.
- [ ] Note: `Product.brand` is a free-text string, not a normalized entity. Phase 8 keeps it as-is — partnerships reference brand names by string match, same as `InfluencerCommissionRule.brandName`.

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**BrandPartnership — an external brand that funds loyalty campaigns through HOS:**

```prisma
model BrandPartnership {
  id               String    @id @default(uuid())
  name             String                           // e.g. "Warner Bros.", "Noble Collection"
  slug             String    @unique
  contactName      String?
  contactEmail     String?
  logoUrl          String?
  description      String?   @db.Text
  status           String    @default("ACTIVE")     // ACTIVE, PAUSED, EXPIRED, ARCHIVED
  contractStart    DateTime
  contractEnd      DateTime
  totalBudget      Decimal   @default(0) @db.Decimal(10, 2)   // Total £/$ allocated
  spentBudget      Decimal   @default(0) @db.Decimal(10, 2)   // Running sum of points cost
  currency         String    @default("GBP")
  metadata         Json?                            // Flexible partner-specific data
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  campaigns        BrandCampaign[]

  @@index([status])
  @@index([slug])
  @@map("brand_partnerships")
}
```

**BrandCampaign — a time-bound, brand-funded loyalty campaign:**

```prisma
model BrandCampaign {
  id                String            @id @default(uuid())
  partnershipId     String
  partnership       BrandPartnership  @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  name              String
  slug              String            @unique
  description       String?           @db.Text
  type              String            @default("MULTIPLIER")   // MULTIPLIER, BONUS_POINTS, EXCLUSIVE_PRODUCT, SPONSORED_EVENT
  status            String            @default("DRAFT")        // DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, CANCELLED
  startsAt          DateTime
  endsAt            DateTime

  // Points mechanics
  multiplier        Decimal?          @db.Decimal(3, 2)        // e.g. 2.0 = 2x points
  bonusPoints       Int?                                        // Flat bonus per qualifying action
  maxPointsPerUser  Int?                                        // Per-user cap for this campaign
  totalPointsBudget Int?                                        // Total points budget across all users

  // Targeting: which products / fandoms / categories qualify
  targetFandoms     String[]          @default([])             // Product.fandom matches
  targetBrands      String[]          @default([])             // Product.brand matches
  targetCategoryIds String[]          @default([])             // Product.categoryId matches
  targetProductIds  String[]          @default([])             // Specific product IDs

  // Audience targeting
  segmentId         String?                                     // AudienceSegment for targeted campaigns
  minTierLevel      Int               @default(0)              // 0 = all tiers
  regionCodes       String[]          @default([])             // Empty = all regions

  // Tracking
  totalPointsAwarded Int              @default(0)
  totalOrders        Int              @default(0)
  totalRevenue       Decimal          @default(0) @db.Decimal(10, 2)
  uniqueUsers        Int              @default(0)

  // Sponsored product / exclusive fields
  featuredProductIds String[]         @default([])             // Products to feature in storefront
  exclusiveTierLevel Int?                                      // Tier required to access exclusive products

  // Marketing integration
  journeySlug       String?                                    // Auto-trigger journey on campaign start
  notifyOnStart     Boolean           @default(true)           // Send notification when campaign goes active

  metadata          Json?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([partnershipId])
  @@index([status])
  @@index([startsAt, endsAt])
  @@map("brand_campaigns")
}
```

**BrandCampaignRedemption — per-user tracking for budget enforcement:**

```prisma
model BrandCampaignRedemption {
  id             String        @id @default(uuid())
  campaignId     String
  userId         String
  orderId        String?
  pointsAwarded  Int
  orderTotal     Decimal?      @db.Decimal(10, 2)
  source         String        @default("PURCHASE")   // PURCHASE, ACTION, MANUAL
  createdAt      DateTime      @default(now())

  @@index([campaignId])
  @@index([userId])
  @@index([campaignId, userId])
  @@map("brand_campaign_redemptions")
}
```

### 2.2 Model Additions

**Add to `LoyaltyTransaction` model (no schema change needed):**

The existing `campaignId` field (String?) on `LoyaltyTransaction` will store the `BrandCampaign.id` when points are earned from a brand campaign. The `source` field will use `BRAND_CAMPAIGN` as a new source value.

**Add to `LoyaltyBonusCampaign` model:**

```prisma
model LoyaltyBonusCampaign {
  // ... existing fields ...
  brandCampaignId   String?          // Links to BrandCampaign if brand-funded
}
```

### 2.3 JobType Additions

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
export enum JobType {
  // ... existing values ...
  BRAND_CAMPAIGN_ACTIVATE = 'brand:campaign-activate',
  BRAND_CAMPAIGN_EXPIRE = 'brand:campaign-expire',
  BRAND_CAMPAIGN_REPORT = 'brand:campaign-report',
}
```

### 2.4 Manual Migration Script

Create `services/api/prisma/migrations/20260801000000_phase8_brand_partnerships/migration.sql`:

```sql
-- Phase 8: Brand Partnership Module

CREATE TABLE IF NOT EXISTS "brand_partnerships" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "totalBudget" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "spentBudget" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_partnerships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "brand_partnerships_slug_key" ON "brand_partnerships"("slug");
CREATE INDEX IF NOT EXISTS "brand_partnerships_status_idx" ON "brand_partnerships"("status");
CREATE INDEX IF NOT EXISTS "brand_partnerships_slug_idx" ON "brand_partnerships"("slug");

CREATE TABLE IF NOT EXISTS "brand_campaigns" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MULTIPLIER',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "multiplier" DECIMAL(3, 2),
    "bonusPoints" INTEGER,
    "maxPointsPerUser" INTEGER,
    "totalPointsBudget" INTEGER,
    "targetFandoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "segmentId" TEXT,
    "minTierLevel" INTEGER NOT NULL DEFAULT 0,
    "regionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "featuredProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusiveTierLevel" INTEGER,
    "journeySlug" TEXT,
    "notifyOnStart" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "brand_campaigns_slug_key" ON "brand_campaigns"("slug");
CREATE INDEX IF NOT EXISTS "brand_campaigns_partnershipId_idx" ON "brand_campaigns"("partnershipId");
CREATE INDEX IF NOT EXISTS "brand_campaigns_status_idx" ON "brand_campaigns"("status");
CREATE INDEX IF NOT EXISTS "brand_campaigns_startsAt_endsAt_idx" ON "brand_campaigns"("startsAt", "endsAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_campaigns_partnershipId_fkey'
  ) THEN
    ALTER TABLE "brand_campaigns"
      ADD CONSTRAINT "brand_campaigns_partnershipId_fkey"
      FOREIGN KEY ("partnershipId") REFERENCES "brand_partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "brand_campaign_redemptions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "pointsAwarded" INTEGER NOT NULL,
    "orderTotal" DECIMAL(10, 2),
    "source" TEXT NOT NULL DEFAULT 'PURCHASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_campaign_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "brand_campaign_redemptions_campaignId_idx" ON "brand_campaign_redemptions"("campaignId");
CREATE INDEX IF NOT EXISTS "brand_campaign_redemptions_userId_idx" ON "brand_campaign_redemptions"("userId");
CREATE INDEX IF NOT EXISTS "brand_campaign_redemptions_campaignId_userId_idx" ON "brand_campaign_redemptions"("campaignId", "userId");

ALTER TABLE "loyalty_bonus_campaigns" ADD COLUMN IF NOT EXISTS "brandCampaignId" TEXT;
```

---

## 3. BRAND PARTNERSHIP MODULE — CORE SERVICE

### 3.1 File Structure

```
services/api/src/brand-partnerships/
├── brand-partnerships.module.ts
├── brand-partnerships.service.ts
├── brand-partnerships.service.spec.ts
├── brand-partnerships-admin.controller.ts
├── brand-partnerships-admin.controller.spec.ts
├── brand-partnerships.controller.ts              # Customer-facing (active campaigns)
├── brand-partnerships.controller.spec.ts
├── dto/
│   ├── create-partnership.dto.ts
│   ├── update-partnership.dto.ts
│   ├── create-brand-campaign.dto.ts
│   └── update-brand-campaign.dto.ts
├── engines/
│   ├── brand-campaign.engine.ts                  # Product-matching + budget enforcement
│   └── brand-campaign.engine.spec.ts
└── jobs/
    ├── brand-campaign.jobs.ts
    └── brand-campaign.jobs.spec.ts
```

### 3.2 BrandPartnershipsService

**File:** `services/api/src/brand-partnerships/brand-partnerships.service.ts`

```typescript
@Injectable()
export class BrandPartnershipsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private segmentation: SegmentationService,
    private marketingBus: MarketingEventBus,
  ) {}

  // ── Partnership CRUD ──

  async createPartnership(dto: CreatePartnershipDto): Promise<BrandPartnership>;
  // 1. Generate slug from name
  // 2. Validate contractStart < contractEnd
  // 3. Create BrandPartnership
  // 4. Return partnership

  async updatePartnership(id: string, dto: UpdatePartnershipDto): Promise<BrandPartnership>;
  async getPartnership(id: string): Promise<BrandPartnership & { campaigns: BrandCampaign[] }>;
  async listPartnerships(filters: {
    status?: string; page?: number; limit?: number; search?: string;
  }): Promise<{ items: BrandPartnership[]; total: number }>;
  async archivePartnership(id: string): Promise<BrandPartnership>;

  // ── Campaign CRUD ──

  async createCampaign(partnershipId: string, dto: CreateBrandCampaignDto): Promise<BrandCampaign>;
  // 1. Validate partnership exists and is ACTIVE
  // 2. Generate slug
  // 3. Create BrandCampaign with status DRAFT
  // 4. Optionally create linked LoyaltyBonusCampaign (for earn engine compatibility)
  // 5. Return campaign

  async updateCampaign(id: string, dto: UpdateBrandCampaignDto): Promise<BrandCampaign>;
  async getCampaign(id: string): Promise<BrandCampaign & { partnership: BrandPartnership }>;

  async listCampaigns(filters: {
    partnershipId?: string; status?: string; type?: string;
    page?: number; limit?: number;
  }): Promise<{ items: BrandCampaign[]; total: number }>;

  async activateCampaign(id: string): Promise<BrandCampaign>;
  // 1. Validate status is DRAFT or SCHEDULED
  // 2. Set status = ACTIVE
  // 3. Create/activate linked LoyaltyBonusCampaign
  // 4. If notifyOnStart, emit BRAND_CAMPAIGN_STARTED marketing event
  // 5. If journeySlug, trigger journey enrollment for segment
  // 6. Return campaign

  async pauseCampaign(id: string): Promise<BrandCampaign>;
  async completeCampaign(id: string): Promise<BrandCampaign>;
  async cancelCampaign(id: string): Promise<BrandCampaign>;

  // ── Campaign Matching ──

  async getActiveCampaignsForOrder(orderItems: OrderItem[], userId: string, regionCode: string): Promise<BrandCampaign[]>;
  // 1. Load all ACTIVE BrandCampaigns within date range
  // 2. Filter by region, tier, segment membership
  // 3. For each order item, check product match (fandom, brand, category, specific IDs)
  // 4. Check per-user budget cap (maxPointsPerUser)
  // 5. Check total budget cap (totalPointsBudget)
  // 6. Return matching campaigns

  async recordRedemption(campaignId: string, userId: string, pointsAwarded: number, orderId?: string, orderTotal?: number): Promise<void>;
  // 1. Create BrandCampaignRedemption
  // 2. Increment campaign totalPointsAwarded, totalOrders, totalRevenue
  // 3. Update uniqueUsers count
  // 4. Update partnership spentBudget

  // ── Earn Engine Integration ──

  async applyBrandCampaigns(
    basePoints: number,
    orderItems: Array<{ productId: string; fandom?: string; brand?: string; categoryId?: string }>,
    userId: string,
    regionCode: string,
    tierLevel: number,
  ): Promise<{ points: number; campaignId?: string; campaignName?: string }>;
  // Called from LoyaltyEarnEngine.processOrderComplete
  // 1. Get matching active campaigns
  // 2. Apply best multiplier + sum bonuses (same logic as LoyaltyCampaignService)
  // 3. Enforce per-user and total budget caps
  // 4. Record redemptions
  // 5. Return boosted points + campaignId

  // ── Customer-Facing ──

  async getActivePublicCampaigns(userId?: string): Promise<PublicBrandCampaign[]>;
  // Active campaigns visible to customer (filtered by tier/segment)
  // Returns: name, description, multiplier/bonus, qualifying products/fandoms, dates

  async getCampaignProducts(campaignId: string, limit?: number): Promise<Product[]>;
  // Products matching the campaign's targeting rules

  // ── Reporting ──

  async getPartnershipReport(id: string): Promise<PartnershipReport>;
  // Total spend, campaign breakdown, ROI metrics, timeline

  async getCampaignReport(id: string): Promise<CampaignReport>;
  // Points awarded, orders, revenue, unique users, daily trend, top products

  async getDashboard(): Promise<BrandPartnershipDashboard>;
  // Total partnerships, active campaigns, total brand-funded points,
  // budget utilization, top partners by spend
}
```

### 3.3 Module

**File:** `services/api/src/brand-partnerships/brand-partnerships.module.ts`

```typescript
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
    SegmentationModule,
    JourneyModule,
  ],
  controllers: [BrandPartnershipsAdminController, BrandPartnershipsController],
  providers: [BrandPartnershipsService, BrandCampaignEngine, BrandCampaignJobsService],
  exports: [BrandPartnershipsService],
})
export class BrandPartnershipsModule {}
```

**Wire into `app.module.ts`:**

```typescript
import { BrandPartnershipsModule } from './brand-partnerships/brand-partnerships.module';
// ...
@Module({
  imports: [
    // ... existing imports ...
    AmbassadorModule,
    BrandPartnershipsModule,  // NEW
  ],
})
```

---

## 4. CAMPAIGN TYPES & FUNDING MODEL

### 4.1 Campaign Types

| Type | Description | Mechanics |
|------|-------------|-----------|
| `MULTIPLIER` | Brand funds X× points on qualifying purchases | multiplier field (e.g. 2.0 = 2× points) |
| `BONUS_POINTS` | Flat bonus points on qualifying purchases | bonusPoints field (e.g. +50 per order) |
| `EXCLUSIVE_PRODUCT` | Tier-gated access to special brand products | exclusiveTierLevel + featuredProductIds |
| `SPONSORED_EVENT` | Brand sponsors event with bonus points | Links to Event via metadata, bonus points for attendance |

### 4.2 Funding Model

- **Brand pays HOS** a contracted budget (tracked on `BrandPartnership.totalBudget`)
- Each campaign's points cost is tracked via `BrandCampaignRedemption` rows
- `BrandPartnership.spentBudget` is the running total
- When `spentBudget >= totalBudget`, campaigns auto-pause (enforced in earn engine)
- HOS absorbs the points cost to the customer — the brand reimburses via contract

### 4.3 Budget Enforcement

```
Per campaign:
  - totalPointsBudget: max total points the campaign can award (null = unlimited)
  - maxPointsPerUser: max points any single user can earn from this campaign (null = unlimited)

Per partnership:
  - totalBudget vs spentBudget: when spent >= total, all campaigns under this partnership are paused
```

---

## 5. POINTS MULTIPLIER & BONUS LOGIC

### 5.1 Integration with Earn Engine

The `LoyaltyEarnEngine.processOrderComplete` currently calls `LoyaltyCampaignService.getActiveForContext` to get `LoyaltyBonusCampaign[]`. Phase 8 adds a parallel call to `BrandPartnershipsService.applyBrandCampaigns`:

```
Base points (from seller earn rate)
  → existing LoyaltyBonusCampaign multiplier/bonus (internal promotions)
  → BrandCampaign multiplier/bonus (brand-funded, stacks ON TOP of internal)
  → Tier multiplier
  → Final points
```

### 5.2 Stacking Rules

- Brand campaign multipliers stack **multiplicatively** with internal campaigns
- Example: Internal 1.5× + Brand 2× on Harry Potter = 1.5 × 2.0 = 3× base points
- Per-user and total budget caps are checked BEFORE awarding
- If budget is exhausted, brand bonus is skipped (internal campaign still applies)

### 5.3 Product Matching

A product qualifies for a brand campaign if ANY of these match:
- `targetProductIds` contains the product ID (most specific)
- `targetBrands` contains `product.brand` (case-insensitive)
- `targetFandoms` contains `product.fandom` (case-insensitive)
- `targetCategoryIds` contains `product.categoryId`
- All target arrays are empty (applies to all products — whole-store promotion)

**File:** `services/api/src/brand-partnerships/engines/brand-campaign.engine.ts`

```typescript
export function productMatchesCampaign(
  product: { id: string; fandom?: string | null; brand?: string | null; categoryId?: string | null },
  campaign: {
    targetProductIds: string[];
    targetBrands: string[];
    targetFandoms: string[];
    targetCategoryIds: string[];
  },
): boolean { ... }
// Returns true if product matches any targeting rule, or all arrays are empty
```

---

## 6. SPONSORED PRODUCTS & TIER EXCLUSIVES

### 6.1 Featured Products

Campaigns can specify `featuredProductIds` — these products get a "Sponsored by {Brand}" badge in the storefront and are surfaced in a dedicated "Brand Picks" section.

### 6.2 Tier-Exclusive Access

Campaigns with `exclusiveTierLevel` set restrict certain products or offers to members at that tier or above. Example: Warner Bros. funds an exclusive wand only available to Dragon Keeper+ members.

### 6.3 Customer Visibility

The customer sees:
- Active brand campaigns on the loyalty page ("Earn 2× points on Harry Potter this month!")
- Sponsored product badges in product listings
- Campaign-specific messaging in order confirmation ("You earned 150 bonus points from Warner Bros.!")

---

## 7. SEGMENT TARGETING INTEGRATION

### 7.1 Segment-Targeted Campaigns

A brand campaign can be targeted to a specific audience segment via `segmentId`. When set:
- Only users in the segment can earn the campaign bonus
- `SegmentationService.getSegmentUserIds` is used at evaluation time
- This enables precise targeting: "2× points for Harry Potter superfans in the UK"

### 7.2 New Segment Dimensions

Add to `services/api/src/segmentation/engines/rule-evaluator.ts` SEGMENT_DIMENSIONS:

| Dimension | Source | Operators |
|-----------|--------|-----------|
| `brand.activeCampaignCount` | Count of BrandCampaignRedemption for user | `gt`, `gte`, `lt`, `lte`, `eq` |
| `brand.hasRedeemed` | User has any BrandCampaignRedemption | `eq` (true/false) |

---

## 8. PARTNER REPORTING & ANALYTICS

### 8.1 Partnership Report

```typescript
interface PartnershipReport {
  partnership: { id: string; name: string; status: string; contractStart: string; contractEnd: string };
  budget: { total: number; spent: number; remaining: number; utilizationPercent: number };
  campaigns: Array<{
    id: string; name: string; type: string; status: string;
    pointsAwarded: number; orders: number; revenue: number; uniqueUsers: number;
  }>;
  timeline: Array<{ date: string; pointsAwarded: number; orders: number; revenue: number }>;
}
```

### 8.2 Campaign Report

```typescript
interface CampaignReport {
  campaign: { id: string; name: string; type: string; status: string; startsAt: string; endsAt: string };
  totals: { pointsAwarded: number; orders: number; revenue: number; uniqueUsers: number };
  budgetUsage: { perUserCap: number | null; totalCap: number | null; used: number };
  dailyTrend: Array<{ date: string; points: number; orders: number }>;
  topProducts: Array<{ productId: string; name: string; orders: number; points: number }>;
}
```

### 8.3 Dashboard

```typescript
interface BrandPartnershipDashboard {
  totalPartnerships: number;
  activePartnerships: number;
  activeCampaigns: number;
  totalBrandFundedPoints: number;
  totalBrandRevenue: number;
  budgetUtilization: number;
  topPartners: Array<{ id: string; name: string; spent: number; campaigns: number }>;
  recentCampaigns: Array<{ id: string; name: string; partnerName: string; status: string; pointsAwarded: number }>;
}
```

---

## 9. JOURNEY & MARKETING INTEGRATION

### 9.1 Marketing Journey Triggers

New trigger events for `MarketingEventBus.emit`:

| Event | When | Data |
|-------|------|------|
| `BRAND_CAMPAIGN_STARTED` | Campaign activated | `{ campaignId, campaignName, partnerName, multiplier, bonusPoints }` |
| `BRAND_CAMPAIGN_ENDING` | 48 hours before campaign ends | `{ campaignId, campaignName, endsAt }` |
| `BRAND_CAMPAIGN_COMPLETED` | Campaign reaches end date or budget | `{ campaignId, campaignName, totalPointsAwarded }` |

### 9.2 Pre-Built Journey (Seed)

Seed a "brand-campaign-notify" journey:
- Trigger: `BRAND_CAMPAIGN_STARTED`
- Steps: SEND email "Earn bonus points with {partnerName}!" → WAIT 24h → SEND push reminder

### 9.3 LoyaltyTransaction Source

Brand-funded transactions use:
- `source: 'BRAND_CAMPAIGN'`
- `campaignId: brandCampaign.id`
- `metadata: { partnerName, campaignName, brandMultiplier }`

---

## 10. REST API ENDPOINTS (Admin)

### 10.1 Brand Partnerships Admin Controller

**File:** `services/api/src/brand-partnerships/brand-partnerships-admin.controller.ts`

Base path: `/admin/brand-partnerships`  
Guards: `JwtAuthGuard`, `RolesGuard`, role `ADMIN`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/brand-partnerships/dashboard` | Programme KPIs |
| `GET` | `/admin/brand-partnerships` | List partnerships (paginated) |
| `POST` | `/admin/brand-partnerships` | Create partnership |
| `GET` | `/admin/brand-partnerships/:id` | Partnership detail + campaigns |
| `PATCH` | `/admin/brand-partnerships/:id` | Update partnership |
| `POST` | `/admin/brand-partnerships/:id/archive` | Archive partnership |
| `GET` | `/admin/brand-partnerships/:id/report` | Partnership report |
| `POST` | `/admin/brand-partnerships/:id/campaigns` | Create campaign under partnership |
| `GET` | `/admin/brand-partnerships/campaigns` | List all campaigns (filterable) |
| `GET` | `/admin/brand-partnerships/campaigns/:id` | Campaign detail |
| `PATCH` | `/admin/brand-partnerships/campaigns/:id` | Update campaign |
| `POST` | `/admin/brand-partnerships/campaigns/:id/activate` | Activate campaign |
| `POST` | `/admin/brand-partnerships/campaigns/:id/pause` | Pause campaign |
| `POST` | `/admin/brand-partnerships/campaigns/:id/complete` | Complete campaign |
| `POST` | `/admin/brand-partnerships/campaigns/:id/cancel` | Cancel campaign |
| `GET` | `/admin/brand-partnerships/campaigns/:id/report` | Campaign report |

**Total: 16 admin endpoints**

---

## 11. REST API ENDPOINTS (Customer-Facing)

### 11.1 Brand Partnerships Customer Controller

**File:** `services/api/src/brand-partnerships/brand-partnerships.controller.ts`

Base path: `/loyalty/brand-campaigns`  
Guards: `JwtAuthGuard`, `RolesGuard`, role `CUSTOMER`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/loyalty/brand-campaigns` | Active public campaigns for user |
| `GET` | `/loyalty/brand-campaigns/:id/products` | Products qualifying for campaign |

**Total: 2 customer endpoints**

---

## 12. FRONTEND PAGES (Admin)

### 12.1 Partnership List — `apps/web/src/app/admin/brand-partnerships/page.tsx`

- Table: Name, Status, Budget (spent/total), Active campaigns, Contract dates, Actions
- Filters: status, search
- Row actions: View / Archive

### 12.2 Partnership Detail — `apps/web/src/app/admin/brand-partnerships/[id]/page.tsx`

- Partnership overview, budget meter
- Campaigns table (under this partnership)
- Report tab with charts

### 12.3 New Partnership — `apps/web/src/app/admin/brand-partnerships/new/page.tsx`

- Form: name, contact, contract dates, budget, description

### 12.4 New Campaign — `apps/web/src/app/admin/brand-partnerships/[id]/campaigns/new/page.tsx`

- Form: name, type, dates, multiplier/bonus, targeting (fandoms, brands, categories), budget caps, segment, tier gate

### 12.5 Campaign Detail — `apps/web/src/app/admin/brand-partnerships/campaigns/[id]/page.tsx`

- Campaign overview, status actions (activate/pause/complete/cancel)
- Report: points awarded, orders, revenue, daily trend, top products

### 12.6 Dashboard — `apps/web/src/app/admin/brand-partnerships/dashboard/page.tsx`

- KPI cards: total partnerships, active campaigns, brand-funded points, budget utilization
- Top partners table
- Recent campaigns

### 12.7 Admin Sidebar Update

**Modify `apps/web/src/components/AdminLayout.tsx`:**

Add to `menuItems` array (after Ambassadors section):

```typescript
{
  title: 'Brand Partnerships',
  icon: '🤝',
  children: [
    { title: 'Partners', href: '/admin/brand-partnerships', icon: '🏢' },
    { title: 'Campaigns', href: '/admin/brand-partnerships/campaigns', icon: '📢' },
    { title: 'New partner', href: '/admin/brand-partnerships/new', icon: '➕' },
    { title: 'Dashboard', href: '/admin/brand-partnerships/dashboard', icon: '📊' },
  ],
},
```

---

## 13. FRONTEND PAGES (Customer)

### 13.1 Brand Campaigns on Loyalty Page

On the existing `apps/web/src/app/loyalty/page.tsx`, add a "Brand Promotions" section showing active campaigns.

### 13.2 No Dedicated Customer Page

Brand campaigns are surfaced inline:
- Loyalty hub → "Active promotions" card
- Product pages → "Earn X× points" badge (future)
- Order confirmation → "Bonus points from {brand}" line item

---

## 14. API CLIENT EXTENSIONS

**File:** `packages/api-client/src/client.ts`

Add the following methods:

```typescript
// ── Brand Partnerships (Customer) ──
async getActiveBrandCampaigns(): Promise<ApiResponse<unknown>>;
async getBrandCampaignProducts(campaignId: string, limit?: number): Promise<ApiResponse<unknown>>;

// ── Brand Partnerships (Admin) ──
async adminGetBrandPartnershipDashboard(): Promise<ApiResponse<unknown>>;
async adminListBrandPartnerships(params?: { status?: string; page?: number; limit?: number; search?: string }): Promise<ApiResponse<unknown>>;
async adminCreateBrandPartnership(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminGetBrandPartnership(id: string): Promise<ApiResponse<unknown>>;
async adminUpdateBrandPartnership(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminArchiveBrandPartnership(id: string): Promise<ApiResponse<unknown>>;
async adminGetBrandPartnershipReport(id: string): Promise<ApiResponse<unknown>>;
async adminCreateBrandCampaign(partnershipId: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminListBrandCampaigns(params?: { partnershipId?: string; status?: string; type?: string; page?: number; limit?: number }): Promise<ApiResponse<unknown>>;
async adminGetBrandCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminUpdateBrandCampaign(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminActivateBrandCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminPauseBrandCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminCompleteBrandCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminCancelBrandCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminGetBrandCampaignReport(id: string): Promise<ApiResponse<unknown>>;
```

**Total: 18 new methods**

---

## 15. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```typescript
interface EnvSchema {
  // ... existing ...
  BRAND_CAMPAIGN_ACTIVATE_CRON?: string;            // Default: '0 0 * * *' (daily midnight)
  BRAND_CAMPAIGN_EXPIRE_CRON?: string;              // Default: '0 1 * * *' (daily 1 AM)
  BRAND_CAMPAIGN_STACKING?: string;                 // Default: 'multiplicative' (or 'additive')
  BRAND_CAMPAIGN_DEFAULT_MAX_PER_USER?: string;     // Default: '' (unlimited)
}
```

No external API keys required for Phase 8.

---

## 16. TESTING STRATEGY

### 16.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `brand-partnerships/engines/brand-campaign.engine.spec.ts` | 8 | Product matching (fandom, brand, category, specific, all-empty, case-insensitive, no match, multi-match) |
| `brand-partnerships/brand-partnerships.service.spec.ts` | 12 | CRUD (partnership + campaign), activate/pause/complete, budget enforcement, per-user cap, earn integration, segment targeting, reporting |
| `brand-partnerships/brand-partnerships-admin.controller.spec.ts` | 6 | List, create, detail, campaign actions, reports, dashboard |
| `brand-partnerships/brand-partnerships.controller.spec.ts` | 3 | Active campaigns, campaign products, unauthenticated rejection |
| `brand-partnerships/jobs/brand-campaign.jobs.spec.ts` | 3 | Activate cron, expire cron, report generation |

**Total: ≥ 32 new tests**

### 16.2 Key Test Scenarios

1. **Product matching:** Harry Potter fandom product matches campaign with `targetFandoms: ['Harry Potter']`
2. **Brand matching:** Noble Collection brand matches `targetBrands: ['Noble Collection']` (case-insensitive)
3. **Per-user cap:** User exceeds `maxPointsPerUser` → bonus capped at remaining allowance
4. **Total budget cap:** Campaign exceeds `totalPointsBudget` → campaign auto-pauses
5. **Partnership budget:** spentBudget >= totalBudget → all campaigns paused
6. **Segment targeting:** Campaign with segmentId → only segment members earn bonus
7. **Tier gate:** Campaign with minTierLevel=4 → tier 3 user gets no bonus
8. **Stacking:** Brand 2× + internal 1.5× = 3× base points
9. **Activate flow:** DRAFT → ACTIVE creates LoyaltyBonusCampaign, emits marketing event
10. **Expire flow:** Past endDate → status set to COMPLETED

### 16.3 Test Commands

```bash
npx jest --testPathPattern="brand-partnerships" --no-cache --forceExit
```

---

## 17. MIGRATION & SEED SCRIPT

### 17.1 Migration

File: `services/api/prisma/migrations/20260801000000_phase8_brand_partnerships/migration.sql` (see §2.4)

### 17.2 Brand Partnership Seed

Create `services/api/prisma/seeds/brand-partnership-seed.ts`:

Seeds:
1. A "Warner Bros." partnership with 2 campaigns (2× Harry Potter multiplier + exclusive wand)
2. A "Noble Collection" partnership with 1 campaign (+50 bonus points on Noble Collection products)
3. A "brand-campaign-notify" journey template

Add to `services/api/package.json`:

```json
"db:seed-brand-partnerships": "ts-node prisma/seeds/brand-partnership-seed.ts"
```

---

## 18. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Admin can create brand partnerships | POST /admin/brand-partnerships → partnership created |
| 2 | Admin can create campaigns under a partnership | POST .../campaigns → campaign with DRAFT status |
| 3 | Admin can activate a campaign | POST .../activate → status ACTIVE, LoyaltyBonusCampaign created |
| 4 | Admin can pause/complete/cancel campaigns | Status transitions work correctly |
| 5 | Products matching campaign rules earn bonus points | Purchase Harry Potter item with 2× campaign → double points |
| 6 | Brand matching is case-insensitive | product.brand "noble collection" matches targetBrands ["Noble Collection"] |
| 7 | Per-user budget cap enforced | After maxPointsPerUser reached, bonus stops for that user |
| 8 | Total campaign budget cap enforced | After totalPointsBudget reached, campaign auto-pauses |
| 9 | Partnership budget cap enforced | After spentBudget >= totalBudget, all campaigns pause |
| 10 | Segment-targeted campaigns only apply to segment members | Non-segment user gets no bonus |
| 11 | Tier-gated campaigns only apply to qualifying tiers | Tier 3 user excluded from minTierLevel=4 campaign |
| 12 | Brand campaign stacks with internal campaign | Internal 1.5× + Brand 2× = 3× base points |
| 13 | LoyaltyTransaction records brand campaign info | source: BRAND_CAMPAIGN, campaignId set, metadata has partner info |
| 14 | Partnership report shows budget utilization | GET report → budget, campaigns, timeline data |
| 15 | Campaign report shows daily trend and top products | GET campaign report → daily points, top products |
| 16 | Dashboard shows aggregated KPIs | GET dashboard → totals, top partners |
| 17 | Customer sees active campaigns on loyalty page | GET /loyalty/brand-campaigns → active campaigns visible |
| 18 | Marketing event emitted on campaign activation | BRAND_CAMPAIGN_STARTED event → journey enrollment |
| 19 | Daily cron activates scheduled campaigns | SCHEDULED campaigns with startsAt <= now → ACTIVE |
| 20 | Daily cron completes expired campaigns | ACTIVE campaigns with endsAt < now → COMPLETED |
| 21 | Admin sidebar shows Brand Partnerships section | Verify menu items in AdminLayout |
| 22 | ≥ 32 unit tests passing | `npx jest --testPathPattern="brand-partnerships"` |
| 23 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 24 | Prisma schema validates | `npx prisma validate` |
| 25 | Earn engine integration does not break existing tests | All 200+ existing tests still pass |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (3 new models + LoyaltyBonusCampaign addition)
│   ├── migrations/
│   │   └── 20260801000000_phase8_brand_partnerships/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── brand-partnership-seed.ts                    # NEW
├── src/
│   ├── brand-partnerships/
│   │   ├── brand-partnerships.module.ts                 # NEW
│   │   ├── brand-partnerships.service.ts                # NEW
│   │   ├── brand-partnerships.service.spec.ts           # NEW
│   │   ├── brand-partnerships-admin.controller.ts       # NEW
│   │   ├── brand-partnerships-admin.controller.spec.ts  # NEW
│   │   ├── brand-partnerships.controller.ts             # NEW (customer-facing)
│   │   ├── brand-partnerships.controller.spec.ts        # NEW
│   │   ├── dto/
│   │   │   ├── create-partnership.dto.ts                # NEW
│   │   │   ├── update-partnership.dto.ts                # NEW
│   │   │   ├── create-brand-campaign.dto.ts             # NEW
│   │   │   └── update-brand-campaign.dto.ts             # NEW
│   │   ├── engines/
│   │   │   ├── brand-campaign.engine.ts                 # NEW
│   │   │   └── brand-campaign.engine.spec.ts            # NEW
│   │   └── jobs/
│   │       ├── brand-campaign.jobs.ts                   # NEW
│   │       └── brand-campaign.jobs.spec.ts              # NEW
│   ├── loyalty/
│   │   └── engines/
│   │       └── earn.engine.ts                           # MODIFIED (integrate BrandPartnershipsService)
│   ├── segmentation/
│   │   └── engines/
│   │       └── rule-evaluator.ts                        # MODIFIED (2 new brand dimensions)
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (3 new job types)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (Phase 8 env vars)
│   └── app.module.ts                                    # MODIFIED (add BrandPartnershipsModule)
├── package.json                                         # MODIFIED (seed script)

apps/web/src/
├── app/
│   ├── loyalty/
│   │   └── page.tsx                                     # MODIFIED (add brand promotions section)
│   └── admin/
│       └── brand-partnerships/
│           ├── page.tsx                                 # NEW — partnership list
│           ├── new/
│           │   └── page.tsx                             # NEW — new partnership form
│           ├── dashboard/
│           │   └── page.tsx                             # NEW — programme KPIs
│           ├── [id]/
│           │   ├── page.tsx                             # NEW — partnership detail
│           │   └── campaigns/
│           │       └── new/
│           │           └── page.tsx                     # NEW — new campaign form
│           └── campaigns/
│               └── [id]/
│                   └── page.tsx                         # NEW — campaign detail + report
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — add Brand Partnerships section

packages/api-client/src/
└── client.ts                                            # MODIFIED (18 new brand partnership methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add `BrandPartnership`, `BrandCampaign`, `BrandCampaignRedemption` models; add `brandCampaignId` to `LoyaltyBonusCampaign`; run migration; regenerate Prisma
2. **JobType additions** — Add `BRAND_CAMPAIGN_ACTIVATE`, `BRAND_CAMPAIGN_EXPIRE`, `BRAND_CAMPAIGN_REPORT` to `queue.bullmq.impl.ts`
3. **Brand campaign engine** — Pure function `productMatchesCampaign` + budget enforcement helpers
4. **DTOs** — `CreatePartnershipDto`, `UpdatePartnershipDto`, `CreateBrandCampaignDto`, `UpdateBrandCampaignDto`
5. **BrandPartnershipsService** — Partnership CRUD, campaign CRUD, activation/lifecycle, matching, reporting, dashboard
6. **Earn engine integration** — Modify `LoyaltyEarnEngine.processOrderComplete` to call `applyBrandCampaigns` after internal campaigns
7. **BrandPartnershipsAdminController** — 16 admin endpoints
8. **BrandPartnershipsController** — 2 customer endpoints
9. **BrandPartnershipsModule** — Wire module with imports
10. **Brand campaign jobs** — `BRAND_CAMPAIGN_ACTIVATE` (daily cron: scheduled → active), `BRAND_CAMPAIGN_EXPIRE` (daily cron: past endDate → completed), `BRAND_CAMPAIGN_REPORT` (on-demand)
11. **Wire to app** — Import `BrandPartnershipsModule` in `app.module.ts`
12. **Env vars** — Add Phase 8 env vars to `env.validation.ts`
13. **Segment dimensions** — Add 2 brand dimensions to `rule-evaluator.ts`
14. **API Client** — Add 18 new methods to `packages/api-client/src/client.ts`
15. **Frontend (admin)** — Partnership list, detail, new partner, new campaign, campaign detail, dashboard, sidebar update
16. **Frontend (customer)** — Brand promotions section on loyalty page
17. **Seed script** — Sample partnerships + campaigns + journey
18. **Unit tests** — ≥ 32 tests across 5 spec files
19. **Build verification** — `npx tsc --noEmit && npx jest --testPathPattern="brand-partnerships" && npx prisma validate`

---

**End of Phase 8 Build Spec**
