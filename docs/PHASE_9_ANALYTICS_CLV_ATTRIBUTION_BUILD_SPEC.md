# Phase 9 — Analytics, CLV & Attribution: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-9-analytics`  
**Base:** `feature/loyalty-phase-1` (all Phase 1–8 work committed)  
**Estimated:** 3–4 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Loyalty Analytics Service — Core](#3-loyalty-analytics-service--core)
4. [Customer Lifetime Value (CLV)](#4-customer-lifetime-value-clv)
5. [Campaign-to-Revenue Attribution](#5-campaign-to-revenue-attribution)
6. [Fandom Trend Analysis](#6-fandom-trend-analysis)
7. [Programme Health & Points Liability](#7-programme-health--points-liability)
8. [Tier Distribution & Movement](#8-tier-distribution--movement)
9. [Channel Performance (Web vs POS)](#9-channel-performance-web-vs-pos)
10. [REST API Endpoints (Admin)](#10-rest-api-endpoints-admin)
11. [Frontend Pages (Admin)](#11-frontend-pages-admin)
12. [API Client Extensions](#12-api-client-extensions)
13. [Cron Jobs & Snapshots](#13-cron-jobs--snapshots)
14. [Environment Variables](#14-environment-variables)
15. [Testing Strategy](#15-testing-strategy)
16. [Migration & Seed Script](#16-migration--seed-script)
17. [Acceptance Criteria](#17-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 9, confirm:

- [ ] Phase 1–8 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 240+ tests pass (loyalty, POS, quiz, journey, messaging, event, segmentation, ambassador, brand-partnerships)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–8 services are functional:
  - `LoyaltyService` (enrollment, earn, redeem, tiers, referrals, adminDashboard)
  - `LoyaltyWalletService` (applyDelta for EARN/BURN/BONUS with touchActivity)
  - `LoyaltyEarnEngine` (processOrderComplete — tier multiplier × earn rule × campaign × brand boost)
  - `LoyaltyCampaignService` (getActiveForContext, applyCampaignsToBasePoints)
  - `BrandPartnershipsService` (applyBrandOrderBoostInTx, reconcileAfterOrder, getDashboard, reports)
  - `SegmentationService` (evaluateSegment, getSegmentUserIds)
  - `AmbassadorService` (enroll, UGC, referral dashboard, adminDashboard)
  - `MarketingEventBus` (emit + broadcast)
  - `AnalyticsService` (getSalesTrends, getCustomerMetrics, getProductPerformance)
  - `DashboardService` (getAdminDashboard)
- [ ] The existing **analytics** module (`services/api/src/analytics/`) provides:
  - `GET /analytics/sales/trends` — sales trends by period
  - `GET /analytics/customers/metrics` — customer retention, avg LTV (basic)
  - `GET /analytics/products/performance` — top products by revenue
  - `GET /analytics/export/:format` — CSV/XLSX/PDF export
- [ ] The existing **dashboard** module (`services/api/src/dashboard/`) provides:
  - `GET /dashboard/admin` — total counts, recent activity, revenue aggregate
- [ ] The existing **loyalty admin** has:
  - `GET /admin/loyalty/dashboard` — member count, tier distribution, points issued/redeemed, liability estimate
- [ ] Note: Phase 9 adds a **dedicated LoyaltyAnalytics module** that extends the existing analytics surface with CLV computation, campaign attribution, fandom trends, daily snapshots, and rich admin dashboards — without replacing the existing analytics endpoints.

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**LoyaltyAnalyticsSnapshot — daily aggregate for time-series dashboards:**

```prisma
model LoyaltyAnalyticsSnapshot {
  id                    String   @id @default(uuid())
  date                  DateTime @unique @db.Date
  totalMembers          Int      @default(0)
  activeMembers30d      Int      @default(0)
  newEnrollments        Int      @default(0)
  pointsIssued          Int      @default(0)
  pointsRedeemed        Int      @default(0)
  pointsExpired         Int      @default(0)
  pointsLiability       Int      @default(0)
  totalRevenueLoyalty    Decimal  @default(0) @db.Decimal(12, 2)
  totalOrdersLoyalty     Int      @default(0)
  avgOrderValueLoyalty   Decimal  @default(0) @db.Decimal(10, 2)
  brandFundedPoints      Int      @default(0)
  campaignPointsIssued   Int      @default(0)
  webOrders              Int      @default(0)
  posOrders              Int      @default(0)
  webRevenue             Decimal  @default(0) @db.Decimal(12, 2)
  posRevenue             Decimal  @default(0) @db.Decimal(12, 2)
  tierDistribution       Json?
  topFandoms             Json?
  metadata               Json?
  createdAt              DateTime @default(now())

  @@index([date])
  @@map("loyalty_analytics_snapshots")
}
```

**CampaignAttribution — links a LoyaltyBonusCampaign / BrandCampaign to revenue impact:**

```prisma
model CampaignAttribution {
  id                String   @id @default(uuid())
  campaignId        String
  campaignType      String                    // 'INTERNAL' | 'BRAND'
  campaignName      String
  date              DateTime @db.Date
  ordersInfluenced  Int      @default(0)
  revenueInfluenced Decimal  @default(0) @db.Decimal(12, 2)
  pointsAwarded     Int      @default(0)
  pointsCost        Decimal  @default(0) @db.Decimal(10, 2)
  uniqueUsers       Int      @default(0)
  roi               Decimal? @db.Decimal(8, 4)
  createdAt         DateTime @default(now())

  @@unique([campaignId, date])
  @@index([campaignId])
  @@index([date])
  @@index([campaignType])
  @@map("campaign_attributions")
}
```

### 2.2 Model Additions

**Add to `LoyaltyMembership` model:**

```prisma
model LoyaltyMembership {
  // ... existing fields ...
  clvScore              Decimal?  @db.Decimal(10, 2)   // Computed CLV
  clvUpdatedAt          DateTime?                       // Last CLV recompute
  predictedChurnRisk    Decimal?  @db.Decimal(5, 4)    // 0.0000–1.0000
  firstPurchaseAt       DateTime?                       // For cohort analysis
  lastPurchaseAt        DateTime?                       // Recency metric
  avgOrderValue         Decimal?  @db.Decimal(10, 2)   // Avg order value for this member
  purchaseFrequency     Decimal?  @db.Decimal(6, 4)    // Orders per month
}
```

### 2.3 JobType Additions

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
export enum JobType {
  // ... existing values ...
  LOYALTY_ANALYTICS_SNAPSHOT = 'loyalty:analytics-snapshot',
  LOYALTY_CLV_RECOMPUTE = 'loyalty:clv-recompute',
  CAMPAIGN_ATTRIBUTION_COMPUTE = 'loyalty:campaign-attribution',
}
```

### 2.4 Manual Migration Script

Create `services/api/prisma/migrations/20260901000000_phase9_analytics_clv/migration.sql`:

```sql
-- Phase 9: Analytics, CLV & Attribution

CREATE TABLE IF NOT EXISTS "loyalty_analytics_snapshots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "activeMembers30d" INTEGER NOT NULL DEFAULT 0,
    "newEnrollments" INTEGER NOT NULL DEFAULT 0,
    "pointsIssued" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "pointsExpired" INTEGER NOT NULL DEFAULT 0,
    "pointsLiability" INTEGER NOT NULL DEFAULT 0,
    "totalRevenueLoyalty" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "totalOrdersLoyalty" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValueLoyalty" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "brandFundedPoints" INTEGER NOT NULL DEFAULT 0,
    "campaignPointsIssued" INTEGER NOT NULL DEFAULT 0,
    "webOrders" INTEGER NOT NULL DEFAULT 0,
    "posOrders" INTEGER NOT NULL DEFAULT 0,
    "webRevenue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "posRevenue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "tierDistribution" JSONB,
    "topFandoms" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_analytics_snapshots_date_key" ON "loyalty_analytics_snapshots"("date");
CREATE INDEX IF NOT EXISTS "loyalty_analytics_snapshots_date_idx" ON "loyalty_analytics_snapshots"("date");

CREATE TABLE IF NOT EXISTS "campaign_attributions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignType" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ordersInfluenced" INTEGER NOT NULL DEFAULT 0,
    "revenueInfluenced" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "pointsCost" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "roi" DECIMAL(8, 4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_attributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_attributions_campaignId_date_key" ON "campaign_attributions"("campaignId", "date");
CREATE INDEX IF NOT EXISTS "campaign_attributions_campaignId_idx" ON "campaign_attributions"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_attributions_date_idx" ON "campaign_attributions"("date");
CREATE INDEX IF NOT EXISTS "campaign_attributions_campaignType_idx" ON "campaign_attributions"("campaignType");

ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "clvScore" DECIMAL(10, 2);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "clvUpdatedAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "predictedChurnRisk" DECIMAL(5, 4);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "firstPurchaseAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "lastPurchaseAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "avgOrderValue" DECIMAL(10, 2);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "purchaseFrequency" DECIMAL(6, 4);
```

---

## 3. LOYALTY ANALYTICS SERVICE — CORE

### 3.1 File Structure

```
services/api/src/loyalty-analytics/
├── loyalty-analytics.module.ts
├── loyalty-analytics.service.ts
├── loyalty-analytics.service.spec.ts
├── loyalty-analytics.controller.ts
├── loyalty-analytics.controller.spec.ts
├── engines/
│   ├── clv.engine.ts                    # CLV computation (RFM-based)
│   ├── clv.engine.spec.ts
│   ├── attribution.engine.ts            # Campaign-to-revenue attribution
│   └── attribution.engine.spec.ts
└── jobs/
    ├── analytics.jobs.ts                # Snapshot + CLV + attribution crons
    └── analytics.jobs.spec.ts
```

### 3.2 LoyaltyAnalyticsService

**File:** `services/api/src/loyalty-analytics/loyalty-analytics.service.ts`

```typescript
@Injectable()
export class LoyaltyAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Daily Snapshot ──

  async computeDailySnapshot(date?: Date): Promise<LoyaltyAnalyticsSnapshot>;
  // 1. Compute all aggregates for the given date (default: yesterday)
  // 2. Upsert into LoyaltyAnalyticsSnapshot
  // 3. Includes: members, active (30d), enrollments, points issued/redeemed/expired,
  //    liability, revenue (loyal orders), avg order value, brand-funded points,
  //    campaign points, web vs POS orders/revenue, tier distribution, top fandoms

  async getSnapshotTimeline(startDate: Date, endDate: Date): Promise<LoyaltyAnalyticsSnapshot[]>;
  // Returns ordered snapshots for the date range

  // ── CLV ──

  async computeClvForMember(membershipId: string): Promise<{ clvScore: number; churnRisk: number }>;
  // RFM-based CLV: Recency × Frequency × Monetary
  // 1. Recency: days since last purchase (lower = better)
  // 2. Frequency: orders per month since enrollment
  // 3. Monetary: average order value
  // 4. Tier multiplier bonus (higher tiers = higher CLV weight)
  // 5. Churn risk: based on recency vs avg purchase frequency
  // 6. Store computed values on LoyaltyMembership

  async recomputeAllClv(batchSize?: number): Promise<{ computed: number; errors: number }>;
  // Batch recompute for all active members

  async getClvDistribution(): Promise<Array<{ bucket: string; count: number; avgClv: number }>>;
  // e.g. "£0–50", "£50–200", "£200–500", "£500+"

  async getTopMembersByClv(limit?: number): Promise<Array<{
    membershipId: string; userId: string; name: string; clvScore: number;
    tier: string; totalSpend: number; purchaseCount: number;
  }>>;

  async getChurnRiskReport(): Promise<{
    atRisk: number; healthy: number; churned: number;
    atRiskMembers: Array<{ userId: string; name: string; lastPurchase: string; churnRisk: number }>;
  }>;

  // ── Campaign Attribution ──

  async computeAttributionForDate(date?: Date): Promise<number>;
  // 1. Find all LoyaltyTransactions for the date with campaignId set
  // 2. Group by campaignId: count orders, sum revenue, sum points
  // 3. Classify as INTERNAL (LoyaltyBonusCampaign) or BRAND (BrandCampaign)
  // 4. Compute points cost (points × redemption value) and ROI
  // 5. Upsert CampaignAttribution rows

  async getCampaignAttributionReport(filters: {
    startDate?: Date; endDate?: Date; campaignType?: string; limit?: number;
  }): Promise<{
    campaigns: Array<{
      campaignId: string; campaignName: string; campaignType: string;
      totalOrders: number; totalRevenue: number; totalPoints: number;
      totalCost: number; roi: number;
    }>;
    totals: { orders: number; revenue: number; points: number; cost: number; avgRoi: number };
  }>;

  async getCampaignRoiTimeline(campaignId: string, days?: number): Promise<Array<{
    date: string; orders: number; revenue: number; points: number; roi: number;
  }>>;

  // ── Fandom Trends ──

  async getFandomTrends(days?: number): Promise<Array<{
    fandom: string; members: number; revenue: number; orders: number;
    avgSpend: number; topProducts: Array<{ name: string; revenue: number }>;
    growth: number; // Percentage change vs prior period
  }>>;

  // ── Programme Health ──

  async getProgrammeHealth(): Promise<{
    totalMembers: number;
    activeLast30d: number;
    activeLast90d: number;
    enrollmentTrend: Array<{ month: string; count: number }>;
    pointsLiability: { total: number; estimatedCost: number };
    pointsVelocity: { issuedLast30d: number; redeemedLast30d: number; netChange: number };
    revenueImpact: { memberRevenue: number; nonMemberRevenue: number; liftPercent: number };
    avgClv: number;
    churnRate: number;
    tierMovement30d: { upgrades: number; downgrades: number };
  }>;

  // ── Tier Analysis ──

  async getTierAnalysis(): Promise<Array<{
    tier: string; level: number; memberCount: number; avgSpend: number;
    avgClv: number; avgPurchaseFreq: number; churnRate: number;
    revenueContribution: number;
  }>>;

  // ── Channel Performance ──

  async getChannelPerformance(days?: number): Promise<{
    web: { orders: number; revenue: number; pointsEarned: number; avgOrder: number };
    pos: { orders: number; revenue: number; pointsEarned: number; avgOrder: number };
    trend: Array<{ date: string; webOrders: number; posOrders: number; webRevenue: number; posRevenue: number }>;
  }>;

  // ── Cohort Analysis ──

  async getCohortRetention(months?: number): Promise<Array<{
    cohort: string;
    enrolled: number;
    retention: number[];
  }>>;
  // Month-over-month retention matrix: e.g. Jan 2026 cohort → [100%, 72%, 58%, ...]

  // ── Export ──

  async exportReport(type: 'clv' | 'attribution' | 'fandom' | 'health', format: 'json' | 'csv'): Promise<unknown>;
}
```

### 3.3 Module

**File:** `services/api/src/loyalty-analytics/loyalty-analytics.module.ts`

```typescript
@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule],
  controllers: [LoyaltyAnalyticsController],
  providers: [LoyaltyAnalyticsService, ClvEngine, AttributionEngine, AnalyticsJobsService],
  exports: [LoyaltyAnalyticsService],
})
export class LoyaltyAnalyticsModule {}
```

**Wire into `app.module.ts`:**

```typescript
import { LoyaltyAnalyticsModule } from './loyalty-analytics/loyalty-analytics.module';
// ...
@Module({
  imports: [
    // ... existing imports ...
    BrandPartnershipsModule,
    LoyaltyAnalyticsModule,  // NEW
  ],
})
```

---

## 4. CUSTOMER LIFETIME VALUE (CLV)

### 4.1 RFM Model

**File:** `services/api/src/loyalty-analytics/engines/clv.engine.ts`

The CLV engine uses an **RFM (Recency, Frequency, Monetary)** model adapted for the loyalty context:

```typescript
export interface RfmInput {
  daysSinceLastPurchase: number;
  totalOrders: number;
  monthsSinceEnrollment: number;
  avgOrderValue: number;
  totalSpend: number;
  tierLevel: number;
  tierMultiplier: number;
  engagementCount: number;
}

export function computeClv(input: RfmInput): { clvScore: number; churnRisk: number };
```

**CLV Formula:**
```
frequency = totalOrders / max(1, monthsSinceEnrollment)
monetary  = avgOrderValue
recencyScore = max(0, 1 - (daysSinceLastPurchase / 365))  // Decays over a year
engagementBonus = 1 + (engagementCount * 0.01)             // Up to +50% at 50 engagements
tierBonus = tierMultiplier                                  // Higher tiers contribute more

clvScore = monetary * frequency * 12 * recencyScore * engagementBonus * tierBonus
```

**Churn Risk:**
```
expectedGap = 30 / max(0.1, frequency)     // Expected days between purchases
actualGap   = daysSinceLastPurchase
churnRisk   = min(1, max(0, (actualGap - expectedGap) / (expectedGap * 2)))
```

### 4.2 CLV Recompute Job

- Runs nightly via `LOYALTY_CLV_RECOMPUTE` cron
- Processes all members with `status != 'SUSPENDED'` in batches (default 200)
- Updates `clvScore`, `predictedChurnRisk`, `clvUpdatedAt`, `avgOrderValue`, `purchaseFrequency`, `firstPurchaseAt`, `lastPurchaseAt` on `LoyaltyMembership`

---

## 5. CAMPAIGN-TO-REVENUE ATTRIBUTION

### 5.1 Attribution Engine

**File:** `services/api/src/loyalty-analytics/engines/attribution.engine.ts`

```typescript
export function computeRoi(pointsAwarded: number, revenueInfluenced: number, pointRedemptionValue: number): number;
// ROI = (revenueInfluenced - (pointsAwarded * pointRedemptionValue)) / (pointsAwarded * pointRedemptionValue)
// Returns 0 if cost is 0
```

### 5.2 Attribution Computation

Daily cron:
1. Query `LoyaltyTransaction` where `campaignId IS NOT NULL` for the target date
2. Join with `Order` to get revenue per order
3. Group by `campaignId`: `ordersInfluenced`, `revenueInfluenced`, `pointsAwarded`
4. Determine `campaignType`: check `BrandCampaign` first, fallback to `LoyaltyBonusCampaign`
5. Compute `pointsCost = pointsAwarded * LOYALTY_DEFAULT_REDEEM_VALUE`
6. Compute `roi`
7. Count distinct users → `uniqueUsers`
8. Upsert into `CampaignAttribution` (unique on `[campaignId, date]`)

---

## 6. FANDOM TREND ANALYSIS

### 6.1 Logic

Fandom trends are computed by aggregating:
- **Member affinity:** Count of members with each fandom in `fandomProfile` JSON
- **Revenue:** Sum of `OrderItem.price * quantity` where `Product.fandom` matches
- **Orders:** Count of orders containing fandom products
- **Growth:** Compare current period vs prior period of same length

### 6.2 Top Fandoms per Snapshot

Daily snapshot stores top 10 fandoms by revenue in `topFandoms` JSON field.

---

## 7. PROGRAMME HEALTH & POINTS LIABILITY

### 7.1 Points Liability

```
totalLiability = sum(LoyaltyMembership.currentBalance) × LOYALTY_DEFAULT_REDEEM_VALUE
```

### 7.2 Points Velocity

- `issuedLast30d`: sum of EARN/BONUS transactions in last 30 days
- `redeemedLast30d`: abs(sum of BURN transactions in last 30 days)
- `netChange`: issued - redeemed

### 7.3 Revenue Impact

- `memberRevenue`: revenue from orders where `userId` has a `LoyaltyMembership`
- `nonMemberRevenue`: revenue from orders where `userId` has no membership
- `liftPercent`: `((memberAvgOrder - nonMemberAvgOrder) / nonMemberAvgOrder) * 100`

---

## 8. TIER DISTRIBUTION & MOVEMENT

### 8.1 Tier Movement (30 days)

Track tier changes by comparing current `tierId` with membership `updatedAt`:
- Upgrades: members whose tier level increased in the last 30 days
- Downgrades: members whose tier level decreased (if applicable)

### 8.2 Tier Revenue Contribution

Per-tier breakdown:
- Total revenue from members at each tier
- Average CLV per tier
- Average purchase frequency per tier

---

## 9. CHANNEL PERFORMANCE (Web vs POS)

### 9.1 Web vs POS Split

Aggregate `LoyaltyTransaction` by `channel`:
- `WEB` → web orders/revenue
- `HOS_OUTLET_POS` → POS orders/revenue
- Daily trend for time-series charts

---

## 10. REST API ENDPOINTS (Admin)

### 10.1 Loyalty Analytics Controller

**File:** `services/api/src/loyalty-analytics/loyalty-analytics.controller.ts`

Base path: `/admin/loyalty-analytics`  
Guards: `JwtAuthGuard`, `RolesGuard`, role `ADMIN`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/loyalty-analytics/health` | Programme health KPIs |
| `GET` | `/admin/loyalty-analytics/snapshots` | Snapshot timeline (query: `startDate`, `endDate`) |
| `GET` | `/admin/loyalty-analytics/clv/distribution` | CLV bucket distribution |
| `GET` | `/admin/loyalty-analytics/clv/top` | Top members by CLV (query: `limit`) |
| `GET` | `/admin/loyalty-analytics/clv/churn` | Churn risk report |
| `GET` | `/admin/loyalty-analytics/attribution` | Campaign attribution report (query: `startDate`, `endDate`, `type`, `limit`) |
| `GET` | `/admin/loyalty-analytics/attribution/:campaignId` | Single campaign ROI timeline (query: `days`) |
| `GET` | `/admin/loyalty-analytics/fandom-trends` | Fandom trends (query: `days`) |
| `GET` | `/admin/loyalty-analytics/tiers` | Tier analysis with CLV and revenue |
| `GET` | `/admin/loyalty-analytics/channels` | Web vs POS performance (query: `days`) |
| `GET` | `/admin/loyalty-analytics/cohorts` | Cohort retention matrix (query: `months`) |
| `POST` | `/admin/loyalty-analytics/snapshots/compute` | Manually trigger snapshot for a date |
| `POST` | `/admin/loyalty-analytics/clv/recompute` | Manually trigger CLV recompute |
| `GET` | `/admin/loyalty-analytics/export/:type` | Export report (query: `format`) |

**Total: 14 admin endpoints**

---

## 11. FRONTEND PAGES (Admin)

### 11.1 Analytics Dashboard — `apps/web/src/app/admin/loyalty-analytics/page.tsx`

Main analytics hub with tabs:
- **Overview:** Programme health KPIs (members, active, liability, revenue lift, avg CLV, churn rate)
- **Trends:** Snapshot timeline charts (enrollment, points velocity, revenue, web vs POS)

### 11.2 CLV Report — `apps/web/src/app/admin/loyalty-analytics/clv/page.tsx`

- CLV distribution chart (buckets)
- Top members table
- Churn risk breakdown

### 11.3 Attribution Report — `apps/web/src/app/admin/loyalty-analytics/attribution/page.tsx`

- Campaign ROI table (sortable)
- Filter by date range and campaign type (INTERNAL / BRAND)
- Totals row with overall ROI

### 11.4 Fandom Trends — `apps/web/src/app/admin/loyalty-analytics/fandom-trends/page.tsx`

- Fandom performance table: revenue, orders, member count, growth %
- Top products per fandom

### 11.5 Tier Analysis — `apps/web/src/app/admin/loyalty-analytics/tiers/page.tsx`

- Per-tier metrics: member count, avg spend, avg CLV, revenue contribution

### 11.6 Channel Performance — `apps/web/src/app/admin/loyalty-analytics/channels/page.tsx`

- Web vs POS comparison cards
- Daily trend chart

### 11.7 Admin Sidebar Update

**Modify `apps/web/src/components/AdminLayout.tsx`:**

Add to `menuItems` array (after Brand Partnerships section):

```typescript
{
  title: 'Loyalty Analytics',
  icon: '📈',
  children: [
    { title: 'Programme health', href: '/admin/loyalty-analytics', icon: '💡' },
    { title: 'CLV report', href: '/admin/loyalty-analytics/clv', icon: '👤' },
    { title: 'Campaign ROI', href: '/admin/loyalty-analytics/attribution', icon: '🎯' },
    { title: 'Fandom trends', href: '/admin/loyalty-analytics/fandom-trends', icon: '⚡' },
    { title: 'Tier analysis', href: '/admin/loyalty-analytics/tiers', icon: '🏆' },
    { title: 'Channels', href: '/admin/loyalty-analytics/channels', icon: '📊' },
  ],
},
```

---

## 12. API CLIENT EXTENSIONS

**File:** `packages/api-client/src/client.ts`

Add the following methods:

```typescript
// ── Loyalty Analytics (Admin) ──
async adminGetLoyaltyHealth(): Promise<ApiResponse<unknown>>;
async adminGetLoyaltySnapshots(params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<unknown>>;
async adminGetClvDistribution(): Promise<ApiResponse<unknown>>;
async adminGetClvTop(limit?: number): Promise<ApiResponse<unknown>>;
async adminGetChurnReport(): Promise<ApiResponse<unknown>>;
async adminGetCampaignAttribution(params?: { startDate?: string; endDate?: string; type?: string; limit?: number }): Promise<ApiResponse<unknown>>;
async adminGetCampaignRoiTimeline(campaignId: string, days?: number): Promise<ApiResponse<unknown>>;
async adminGetFandomTrends(days?: number): Promise<ApiResponse<unknown>>;
async adminGetTierAnalysis(): Promise<ApiResponse<unknown>>;
async adminGetChannelPerformance(days?: number): Promise<ApiResponse<unknown>>;
async adminGetCohortRetention(months?: number): Promise<ApiResponse<unknown>>;
async adminComputeSnapshot(date?: string): Promise<ApiResponse<unknown>>;
async adminRecomputeClv(): Promise<ApiResponse<unknown>>;
async adminExportLoyaltyReport(type: string, format?: string): Promise<ApiResponse<unknown>>;
```

**Total: 14 new methods**

---

## 13. CRON JOBS & SNAPSHOTS

### 13.1 Job Schedule

| Job Type | Default Cron | Description |
|----------|-------------|-------------|
| `LOYALTY_ANALYTICS_SNAPSHOT` | `'30 2 * * *'` (2:30 AM daily) | Compute yesterday's snapshot |
| `LOYALTY_CLV_RECOMPUTE` | `'0 3 * * 0'` (3:00 AM Sunday) | Batch recompute CLV for all members |
| `CAMPAIGN_ATTRIBUTION_COMPUTE` | `'45 2 * * *'` (2:45 AM daily) | Compute yesterday's campaign attribution |

### 13.2 Job Implementation

**File:** `services/api/src/loyalty-analytics/jobs/analytics.jobs.ts`

- Registers 3 processors
- Schedules 3 cron jobs on module init
- Each job logs completion metrics

---

## 14. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```typescript
interface EnvSchema {
  // ... existing ...
  LOYALTY_ANALYTICS_SNAPSHOT_CRON?: string;       // Default: '30 2 * * *'
  LOYALTY_CLV_RECOMPUTE_CRON?: string;            // Default: '0 3 * * 0'
  LOYALTY_CLV_BATCH_SIZE?: string;                // Default: '200'
  CAMPAIGN_ATTRIBUTION_CRON?: string;             // Default: '45 2 * * *'
}
```

---

## 15. TESTING STRATEGY

### 15.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `loyalty-analytics/engines/clv.engine.spec.ts` | 6 | CLV computation (new member, high-value, churned, tier bonus, zero orders, frequency calculation) |
| `loyalty-analytics/engines/attribution.engine.spec.ts` | 4 | ROI computation (positive, negative, zero cost, high volume) |
| `loyalty-analytics/loyalty-analytics.service.spec.ts` | 12 | Snapshots (compute, timeline), CLV (member, batch, distribution, top, churn), attribution (compute, report, timeline), fandom trends, health, channels |
| `loyalty-analytics/loyalty-analytics.controller.spec.ts` | 8 | Health, snapshots, CLV endpoints, attribution endpoints, fandom, tiers, channels, export |
| `loyalty-analytics/jobs/analytics.jobs.spec.ts` | 3 | Snapshot cron, CLV cron, attribution cron |

**Total: ≥ 33 new tests**

### 15.2 Key Test Scenarios

1. **CLV new member:** 1 order, enrolled 1 month ago → CLV reflects single purchase projected
2. **CLV high-value:** 50 orders over 12 months, tier 5 → high CLV score
3. **CLV churned:** Last purchase 180 days ago, 2 orders → high churn risk > 0.7
4. **Attribution ROI:** Campaign awarded 1000 pts on £500 revenue, redeem value £0.01 → ROI = (500 - 10) / 10 = 49
5. **Snapshot aggregation:** Correctly sums EARN/BURN/BONUS by date, splits web/POS
6. **Fandom trends growth:** Compare 30-day window vs prior 30 days → growth %
7. **Channel split:** Web orders separate from POS orders in snapshot

### 15.3 Test Commands

```bash
npx jest --testPathPattern="loyalty-analytics" --no-cache --forceExit
```

---

## 16. MIGRATION & SEED SCRIPT

### 16.1 Migration

File: `services/api/prisma/migrations/20260901000000_phase9_analytics_clv/migration.sql` (see §2.4)

### 16.2 Analytics Seed

Create `services/api/prisma/seeds/analytics-seed.ts`:

Seeds:
1. Backfill `firstPurchaseAt` and `lastPurchaseAt` on existing memberships from `Order.createdAt`
2. Generate 30 days of `LoyaltyAnalyticsSnapshot` from historical transaction data
3. Trigger initial CLV computation for all members

Add to `services/api/package.json`:

```json
"db:seed-analytics": "ts-node prisma/seeds/analytics-seed.ts"
```

---

## 17. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Daily snapshot captures all required aggregates | POST compute → verify all fields populated |
| 2 | Snapshot timeline renders trend charts | GET snapshots → array with date-ordered rows |
| 3 | CLV computes correctly for a member with orders | GET clv/top → members have non-zero clvScore |
| 4 | CLV batch recompute processes all members | POST clv/recompute → computed count matches member count |
| 5 | CLV distribution shows meaningful buckets | GET clv/distribution → at least 2 buckets |
| 6 | Churn risk identifies at-risk members | GET clv/churn → atRisk count > 0 for inactive members |
| 7 | Campaign attribution links campaigns to revenue | GET attribution → campaigns with ordersInfluenced > 0 |
| 8 | Attribution ROI is computed correctly | ROI matches formula: (revenue - cost) / cost |
| 9 | Campaign ROI timeline shows daily data | GET attribution/:id → array of daily entries |
| 10 | Fandom trends show revenue by fandom | GET fandom-trends → entries with revenue, orders, growth |
| 11 | Programme health returns all KPIs | GET health → totalMembers, liability, velocity, revenueImpact |
| 12 | Revenue impact compares member vs non-member | health.revenueImpact.liftPercent is a number |
| 13 | Tier analysis shows per-tier CLV and revenue | GET tiers → array with avgClv and revenueContribution |
| 14 | Channel performance splits web vs POS | GET channels → web and pos objects with orders/revenue |
| 15 | Cohort retention matrix is computable | GET cohorts → array with retention arrays |
| 16 | Export returns data in requested format | GET export/clv?format=json → JSON report |
| 17 | Admin sidebar shows Loyalty Analytics section | Verify 6 menu items in AdminLayout |
| 18 | 6 admin pages render without errors | Visit each page → loading → data displayed |
| 19 | 14 API client methods defined | Grep client.ts for method names → 14 matches |
| 20 | Daily crons scheduled on module init | Check logs for 3 cron registrations |
| 21 | ≥ 33 unit tests passing | `npx jest --testPathPattern="loyalty-analytics"` |
| 22 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 23 | Prisma schema validates | `npx prisma validate` |
| 24 | Existing 240+ tests still pass | Full test suite green |
| 25 | LoyaltyMembership CLV fields populated after recompute | Query membership → clvScore, churnRisk non-null |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (2 new models + LoyaltyMembership CLV fields)
│   ├── migrations/
│   │   └── 20260901000000_phase9_analytics_clv/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── analytics-seed.ts                            # NEW
├── src/
│   ├── loyalty-analytics/
│   │   ├── loyalty-analytics.module.ts                  # NEW
│   │   ├── loyalty-analytics.service.ts                 # NEW
│   │   ├── loyalty-analytics.service.spec.ts            # NEW
│   │   ├── loyalty-analytics.controller.ts              # NEW
│   │   ├── loyalty-analytics.controller.spec.ts         # NEW
│   │   ├── engines/
│   │   │   ├── clv.engine.ts                            # NEW
│   │   │   ├── clv.engine.spec.ts                       # NEW
│   │   │   ├── attribution.engine.ts                    # NEW
│   │   │   └── attribution.engine.spec.ts               # NEW
│   │   └── jobs/
│   │       ├── analytics.jobs.ts                        # NEW
│   │       └── analytics.jobs.spec.ts                   # NEW
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (3 new job types)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (Phase 9 env vars)
│   └── app.module.ts                                    # MODIFIED (add LoyaltyAnalyticsModule)
├── package.json                                         # MODIFIED (seed script)

apps/web/src/
├── app/
│   └── admin/
│       └── loyalty-analytics/
│           ├── page.tsx                                 # NEW — programme health overview
│           ├── clv/
│           │   └── page.tsx                             # NEW — CLV report
│           ├── attribution/
│           │   └── page.tsx                             # NEW — campaign ROI
│           ├── fandom-trends/
│           │   └── page.tsx                             # NEW — fandom trends
│           ├── tiers/
│           │   └── page.tsx                             # NEW — tier analysis
│           └── channels/
│               └── page.tsx                             # NEW — web vs POS
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — add Loyalty Analytics section

packages/api-client/src/
└── client.ts                                            # MODIFIED (14 new analytics methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add `LoyaltyAnalyticsSnapshot`, `CampaignAttribution` models; add CLV fields to `LoyaltyMembership`; run migration; regenerate Prisma
2. **JobType additions** — Add `LOYALTY_ANALYTICS_SNAPSHOT`, `LOYALTY_CLV_RECOMPUTE`, `CAMPAIGN_ATTRIBUTION_COMPUTE`
3. **CLV engine** — Pure function `computeClv` with RFM model
4. **Attribution engine** — Pure function `computeRoi`
5. **LoyaltyAnalyticsService** — Snapshot, CLV, attribution, fandom, health, tiers, channels, cohorts, export
6. **LoyaltyAnalyticsController** — 14 admin endpoints
7. **LoyaltyAnalyticsModule** — Wire module with imports
8. **Analytics jobs** — 3 cron jobs (snapshot, CLV, attribution)
9. **Wire to app** — Import `LoyaltyAnalyticsModule` in `app.module.ts`
10. **Env vars** — Add Phase 9 env vars to `env.validation.ts`
11. **API Client** — Add 14 new methods to `packages/api-client/src/client.ts`
12. **Frontend (admin)** — 6 pages + sidebar update
13. **Seed script** — Backfill CLV fields, generate historical snapshots
14. **Unit tests** — ≥ 33 tests across 5 spec files
15. **Build verification** — `npx tsc --noEmit && npx jest --testPathPattern="loyalty-analytics" && npx prisma validate`

---

**End of Phase 9 Build Spec**
