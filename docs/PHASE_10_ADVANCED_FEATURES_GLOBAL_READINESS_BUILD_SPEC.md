# Phase 10 — Advanced Features & Global Readiness: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-10-advanced`  
**Base:** `feature/loyalty-phase-1` (all Phase 1–9 work committed)  
**Estimated:** 2–3 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Click & Collect (Reserve Online, Pick Up In-Store)](#2-click--collect-reserve-online-pick-up-in-store)
3. [Product Campaigns (Loyalty-Integrated Promotions)](#3-product-campaigns-loyalty-integrated-promotions)
4. [New Outlet Onboarding System](#4-new-outlet-onboarding-system)
5. [Global Readiness — Multi-Region & Multi-Currency](#5-global-readiness--multi-region--multi-currency)
6. [Schema Changes (Prisma)](#6-schema-changes-prisma)
7. [REST API Endpoints](#7-rest-api-endpoints)
8. [Frontend Pages](#8-frontend-pages)
9. [API Client Extensions](#9-api-client-extensions)
10. [Environment Variables](#10-environment-variables)
11. [Testing Strategy](#11-testing-strategy)
12. [Migration & Seed Script](#12-migration--seed-script)
13. [Acceptance Criteria](#13-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 10, confirm:

- [ ] Phase 1–9 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 270+ tests pass (loyalty, POS, quiz, journey, messaging, event, segmentation, ambassador, brand-partnerships, loyalty-analytics)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–9 services are functional:
  - `LoyaltyService`, `LoyaltyEarnEngine`, `LoyaltyWalletService`
  - `BrandPartnershipsService` (campaigns, matching, budgets)
  - `LoyaltyAnalyticsService` (CLV, attribution, snapshots)
  - `SegmentationService`, `AmbassadorService`
  - `ChannelsService` (ProductChannel CRUD, resolvePrice)
  - `InventoryService` (reserve, release, stock movements)
  - POS sync pipeline (product, inventory, customer, sales)
  - `ShippingService` (PICKUP_IN_STORE type exists, priced at £0)
- [ ] Note: Phase 10 is the **final phase** of The Enchanted Circle. It introduces **Click & Collect** (BOPIS), a **product campaign** layer for time-limited loyalty promotions on specific products, a **new outlet onboarding** admin workflow, and **global readiness** hardening (multi-currency alignment, region-aware defaults, expanded currency support).

---

## 2. CLICK & COLLECT (Reserve Online, Pick Up In-Store)

### 2.1 Overview

Click & Collect (C&C) allows customers to place an order online and pick it up at a chosen HOS store. The customer earns loyalty points at order completion. The store prepares the order and marks it ready for pickup. On collection, the customer presents their loyalty QR or order confirmation.

### 2.2 Existing Building Blocks

- `ShippingMethodType.PICKUP_IN_STORE` enum value in schema
- `ShippingService` returns `£0` for pickup
- `InventoryService` has `RESERVE` stock movement type
- `Store` model has `address`, `city`, `country`, `operatingHours`, `latitude`, `longitude`
- `ProductChannel` ties products to specific stores

### 2.3 New Model: `ClickCollectOrder`

```prisma
model ClickCollectOrder {
  id              String    @id @default(uuid())
  orderId         String    @unique
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  storeId         String
  store           Store     @relation(fields: [storeId], references: [id])
  status          String    @default("PENDING")       // PENDING, PREPARING, READY, COLLECTED, CANCELLED, EXPIRED
  estimatedReady  DateTime?
  readyAt         DateTime?
  collectedAt     DateTime?
  collectedBy     String?                              // Staff user who marked collected
  notifiedAt      DateTime?                            // When "ready for pickup" notification was sent
  expiresAt       DateTime?                            // Auto-cancel if not collected
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([storeId])
  @@index([status])
  @@index([orderId])
  @@map("click_collect_orders")
}
```

### 2.4 C&C Service

**File:** `services/api/src/click-collect/click-collect.service.ts`

Key methods:
- `createClickCollect(orderId, storeId, estimatedReady?)` — Creates C&C record, reserves inventory at store
- `markPreparing(id)` — Staff begins preparing the order
- `markReady(id)` — Sets `readyAt`, sends push/email notification to customer ("Your order is ready!")
- `markCollected(id, staffUserId)` — Sets `collectedAt`, awards loyalty points if not already earned
- `cancelClickCollect(id)` — Releases inventory, updates order status
- `expireStaleOrders()` — Cron: cancel orders not collected within `CC_EXPIRY_HOURS` (default 72h)
- `getStoreAvailability(storeId)` — Count of pending/ready orders for a store
- `listByStore(storeId, status?)` — Store staff view
- `listByCustomer(userId)` — Customer's active C&C orders
- `getEligibleStores(productIds)` — Stores that have all requested products in stock via ProductChannel

### 2.5 Marketing Integration

- Trigger `CLICK_COLLECT_READY` marketing event when order marked ready → customer notification journey
- Trigger `CLICK_COLLECT_REMINDER` 24h before expiry → push reminder

### 2.6 Loyalty Integration

- Points earned at `processOrderComplete` as normal (WEB channel)
- C&C orders count as WEB orders for channel analytics (placed online)
- Bonus points for choosing C&C configurable via `CC_BONUS_POINTS` env var (default 0)

---

## 3. PRODUCT CAMPAIGNS (Loyalty-Integrated Promotions)

### 3.1 Overview

Product campaigns are **time-limited, loyalty-integrated promotions** on specific products. Unlike `Promotion` (commerce-level discounts) or `BrandCampaign` (brand-funded points), product campaigns offer **bonus loyalty points, early access, or exclusive availability** for specific products — driven by the loyalty team, not finance or brand partners.

### 3.2 New Model: `ProductCampaign`

```prisma
model ProductCampaign {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  description     String?   @db.Text
  type            String    @default("BONUS_POINTS")   // BONUS_POINTS, EARLY_ACCESS, EXCLUSIVE
  status          String    @default("DRAFT")           // DRAFT, SCHEDULED, ACTIVE, COMPLETED, CANCELLED
  startsAt        DateTime
  endsAt          DateTime
  productIds      String[]  @default([])                // Specific products
  categoryIds     String[]  @default([])                // Or entire categories
  fandomFilter    String[]  @default([])                // Or by fandom
  bonusPoints     Int?                                   // Extra points per qualifying purchase
  minTierLevel    Int       @default(0)                  // Tier gate
  regionCodes     String[]  @default([])                // Region restriction
  maxRedemptions  Int?                                   // Total cap
  totalRedemptions Int      @default(0)
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status])
  @@index([startsAt, endsAt])
  @@map("product_campaigns")
}
```

### 3.3 Product Campaign Service

**File:** `services/api/src/product-campaigns/product-campaigns.service.ts`

Key methods:
- `create(dto)` / `update(id, dto)` / `get(id)` / `list(filters)` — CRUD
- `activate(id)` / `complete(id)` / `cancel(id)` — Lifecycle
- `getActiveForProduct(productId, tierLevel, regionCode)` — Active campaigns matching a product
- `applyProductCampaignBonus(orderItems, userId, tierLevel, regionCode)` — Called from earn engine, returns bonus points
- `runScheduledActivations()` / `runExpiredCompletions()` — Crons

### 3.4 Earn Engine Integration

In `LoyaltyEarnEngine.processOrderComplete`, after internal campaigns and brand campaigns, add:
```
→ ProductCampaign bonus (flat points per qualifying product, capped by maxRedemptions)
```

---

## 4. NEW OUTLET ONBOARDING SYSTEM

### 4.1 Overview

When HOS opens a new physical outlet (UK, NYC, or future locations), the admin needs a structured workflow to bring the store online across all platform systems. Phase 10 introduces an **outlet onboarding checklist** in the admin UI.

### 4.2 New Model: `StoreOnboardingChecklist`

```prisma
model StoreOnboardingChecklist {
  id               String    @id @default(uuid())
  storeId          String    @unique
  store            Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  steps            Json                                 // Array of { key, label, completedAt, completedBy }
  status           String    @default("IN_PROGRESS")    // IN_PROGRESS, COMPLETED
  startedAt        DateTime  @default(now())
  completedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@map("store_onboarding_checklists")
}
```

### 4.3 Default Onboarding Steps

```typescript
const DEFAULT_STEPS = [
  { key: 'store_created', label: 'Store record created with address, timezone, currency' },
  { key: 'pos_connected', label: 'POS connection established and tested' },
  { key: 'products_assigned', label: 'Products assigned to store channel with local pricing' },
  { key: 'product_sync', label: 'Initial product sync to POS completed' },
  { key: 'inventory_loaded', label: 'Opening inventory loaded and synced' },
  { key: 'staff_trained', label: 'Staff trained on loyalty QR scan and point redemption' },
  { key: 'test_transaction', label: 'Test loyalty transaction processed end-to-end' },
  { key: 'signage_installed', label: 'Loyalty QR code signage installed in-store' },
  { key: 'marketing_configured', label: 'Tourist welcome journey configured for store region' },
  { key: 'go_live', label: 'Store marked active and visible to customers' },
];
```

### 4.4 Store CRUD API

Add missing endpoints to manage stores (currently stores may be seeded only):

- `POST /admin/stores` — Create store
- `GET /admin/stores` — List stores with onboarding status
- `GET /admin/stores/:id` — Store detail + onboarding checklist
- `PATCH /admin/stores/:id` — Update store details
- `POST /admin/stores/:id/onboarding/step` — Mark a step complete
- `POST /admin/stores/:id/onboarding/complete` — Mark full onboarding complete
- `POST /admin/stores/:id/activate` — Set `isActive = true`
- `POST /admin/stores/:id/deactivate` — Set `isActive = false`

---

## 5. GLOBAL READINESS — MULTI-REGION & MULTI-CURRENCY

### 5.1 Currency Support Expansion

The existing `CurrencyService` supports `['USD', 'EUR', 'AED']`. Phase 10 expands to:
```typescript
const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR', 'AED', 'JPY', 'AUD', 'CAD', 'SGD'];
```

### 5.2 Region-Aware Defaults

Add to `Store` model:
```prisma
model Store {
  // ... existing fields ...
  defaultRegionCode  String   @default("GB")
  loyaltyRedeemValue Decimal  @default(0.01) @db.Decimal(8, 6)  // Points → currency
}
```

This allows NYC store to use `currency: 'USD'`, `defaultRegionCode: 'US'`, `loyaltyRedeemValue: 0.01` (100 pts = $1).

### 5.3 Tourist Detection Enhancement

Extend `SegmentationService` with a new dimension:
- `geo.isTourist` — `eq` operator — user's country differs from the store's region where their most recent purchase occurred

### 5.4 Multi-Region Points Liability

In `LoyaltyAnalyticsService.getProgrammeHealth`, break down liability by store region:
```typescript
liabilityByRegion: Array<{ region: string; totalPoints: number; estimatedCost: number }>
```

---

## 6. SCHEMA CHANGES (Prisma)

### 6.1 New Models

- `ClickCollectOrder` (see §2.3)
- `ProductCampaign` (see §3.2)
- `StoreOnboardingChecklist` (see §4.2)

### 6.2 Model Additions

**Store:**
```prisma
  defaultRegionCode   String   @default("GB")
  loyaltyRedeemValue  Decimal  @default(0.01) @db.Decimal(8, 6)
```

**Order (relation):**
```prisma
  clickCollect  ClickCollectOrder?
```

### 6.3 JobType Additions

```typescript
export enum JobType {
  // ... existing ...
  CLICK_COLLECT_EXPIRY = 'cc:expiry',
  CLICK_COLLECT_REMINDER = 'cc:reminder',
  PRODUCT_CAMPAIGN_ACTIVATE = 'product-campaign:activate',
  PRODUCT_CAMPAIGN_EXPIRE = 'product-campaign:expire',
}
```

### 6.4 Migration Script

File: `services/api/prisma/migrations/20261001000000_phase10_advanced_global/migration.sql`

---

## 7. REST API ENDPOINTS

### 7.1 Click & Collect (Admin + Customer)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `POST` | `/click-collect` | CUSTOMER | Create C&C order (after checkout with PICKUP_IN_STORE) |
| `GET` | `/click-collect/my-orders` | CUSTOMER | Customer's C&C orders |
| `GET` | `/click-collect/stores` | CUSTOMER | Eligible stores for product list |
| `GET` | `/admin/click-collect` | ADMIN | List all C&C orders (filterable) |
| `GET` | `/admin/click-collect/:id` | ADMIN | C&C order detail |
| `POST` | `/admin/click-collect/:id/preparing` | ADMIN | Mark preparing |
| `POST` | `/admin/click-collect/:id/ready` | ADMIN | Mark ready (triggers notification) |
| `POST` | `/admin/click-collect/:id/collected` | ADMIN | Mark collected |
| `POST` | `/admin/click-collect/:id/cancel` | ADMIN | Cancel C&C |

### 7.2 Product Campaigns (Admin)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET` | `/admin/product-campaigns` | ADMIN | List campaigns |
| `POST` | `/admin/product-campaigns` | ADMIN | Create campaign |
| `GET` | `/admin/product-campaigns/:id` | ADMIN | Campaign detail |
| `PATCH` | `/admin/product-campaigns/:id` | ADMIN | Update campaign |
| `POST` | `/admin/product-campaigns/:id/activate` | ADMIN | Activate |
| `POST` | `/admin/product-campaigns/:id/complete` | ADMIN | Complete |
| `POST` | `/admin/product-campaigns/:id/cancel` | ADMIN | Cancel |

### 7.3 Store Management (Admin)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET` | `/admin/stores` | ADMIN | List stores with onboarding |
| `POST` | `/admin/stores` | ADMIN | Create store |
| `GET` | `/admin/stores/:id` | ADMIN | Store detail + checklist |
| `PATCH` | `/admin/stores/:id` | ADMIN | Update store |
| `POST` | `/admin/stores/:id/activate` | ADMIN | Activate store |
| `POST` | `/admin/stores/:id/deactivate` | ADMIN | Deactivate |
| `POST` | `/admin/stores/:id/onboarding/step` | ADMIN | Complete onboarding step |
| `POST` | `/admin/stores/:id/onboarding/complete` | ADMIN | Finish onboarding |

### 7.4 Global Config (Admin)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET` | `/admin/global/currencies` | ADMIN | Supported currencies + rates |
| `POST` | `/admin/global/currencies/refresh` | ADMIN | Refresh exchange rates |

**Total: 26 endpoints (9 C&C + 7 product campaigns + 8 stores + 2 global)**

---

## 8. FRONTEND PAGES

### 8.1 Click & Collect

- `apps/web/src/app/admin/click-collect/page.tsx` — C&C order list with status filters
- `apps/web/src/app/admin/click-collect/[id]/page.tsx` — C&C order detail + status actions

### 8.2 Product Campaigns

- `apps/web/src/app/admin/product-campaigns/page.tsx` — Campaign list
- `apps/web/src/app/admin/product-campaigns/new/page.tsx` — New campaign form
- `apps/web/src/app/admin/product-campaigns/[id]/page.tsx` — Campaign detail + actions

### 8.3 Store Management

- `apps/web/src/app/admin/stores/page.tsx` — Store list with onboarding status badges
- `apps/web/src/app/admin/stores/new/page.tsx` — New store form
- `apps/web/src/app/admin/stores/[id]/page.tsx` — Store detail + onboarding checklist

### 8.4 Admin Sidebar Update

Add to `AdminLayout.tsx`:

```typescript
{
  title: 'Click & Collect',
  icon: '🏪',
  children: [
    { title: 'Orders', href: '/admin/click-collect', icon: '📦' },
  ],
},
{
  title: 'Product Campaigns',
  icon: '🎪',
  children: [
    { title: 'All campaigns', href: '/admin/product-campaigns', icon: '📋' },
    { title: 'New campaign', href: '/admin/product-campaigns/new', icon: '➕' },
  ],
},
{
  title: 'Stores',
  icon: '🏬',
  children: [
    { title: 'All stores', href: '/admin/stores', icon: '📍' },
    { title: 'New store', href: '/admin/stores/new', icon: '➕' },
  ],
},
```

**Total: 8 new admin pages + sidebar updates**

---

## 9. API CLIENT EXTENSIONS

Add 26 new methods to `packages/api-client/src/client.ts`:

```typescript
// Click & Collect (Customer)
async createClickCollect(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async getMyClickCollectOrders(): Promise<ApiResponse<unknown>>;
async getClickCollectStores(productIds: string[]): Promise<ApiResponse<unknown>>;

// Click & Collect (Admin)
async adminListClickCollect(params?: { storeId?: string; status?: string }): Promise<ApiResponse<unknown>>;
async adminGetClickCollect(id: string): Promise<ApiResponse<unknown>>;
async adminMarkCCPreparing(id: string): Promise<ApiResponse<unknown>>;
async adminMarkCCReady(id: string): Promise<ApiResponse<unknown>>;
async adminMarkCCCollected(id: string): Promise<ApiResponse<unknown>>;
async adminCancelCC(id: string): Promise<ApiResponse<unknown>>;

// Product Campaigns (Admin)
async adminListProductCampaigns(params?: { status?: string }): Promise<ApiResponse<unknown>>;
async adminCreateProductCampaign(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminGetProductCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminUpdateProductCampaign(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminActivateProductCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminCompleteProductCampaign(id: string): Promise<ApiResponse<unknown>>;
async adminCancelProductCampaign(id: string): Promise<ApiResponse<unknown>>;

// Stores (Admin)
async adminListStores(): Promise<ApiResponse<unknown>>;
async adminCreateStore(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminGetStore(id: string): Promise<ApiResponse<unknown>>;
async adminUpdateStore(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminActivateStore(id: string): Promise<ApiResponse<unknown>>;
async adminDeactivateStore(id: string): Promise<ApiResponse<unknown>>;
async adminCompleteOnboardingStep(storeId: string, step: string): Promise<ApiResponse<unknown>>;
async adminCompleteOnboarding(storeId: string): Promise<ApiResponse<unknown>>;

// Global
async adminGetCurrencies(): Promise<ApiResponse<unknown>>;
async adminRefreshCurrencies(): Promise<ApiResponse<unknown>>;
```

---

## 10. ENVIRONMENT VARIABLES

```typescript
interface EnvSchema {
  // ... existing ...
  CC_EXPIRY_HOURS?: string;                  // Default: '72'
  CC_BONUS_POINTS?: string;                  // Default: '0'
  CC_REMINDER_HOURS_BEFORE?: string;         // Default: '24'
  PRODUCT_CAMPAIGN_ACTIVATE_CRON?: string;   // Default: '0 0 * * *'
  PRODUCT_CAMPAIGN_EXPIRE_CRON?: string;     // Default: '0 1 * * *'
  CC_EXPIRY_CRON?: string;                   // Default: '0 6 * * *'
  GLOBAL_SUPPORTED_CURRENCIES?: string;      // Default: 'GBP,USD,EUR,AED,JPY,AUD,CAD,SGD'
}
```

---

## 11. TESTING STRATEGY

### 11.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `click-collect/click-collect.service.spec.ts` | 10 | Create, status transitions, expiry, inventory reserve/release, eligible stores, notifications |
| `click-collect/click-collect.controller.spec.ts` | 6 | Admin + customer endpoints |
| `product-campaigns/product-campaigns.service.spec.ts` | 8 | CRUD, activation, earn integration, capped redemptions, fandom/category matching |
| `product-campaigns/product-campaigns.controller.spec.ts` | 4 | List, create, activate, complete |
| `stores/store-onboarding.service.spec.ts` | 6 | Create store, checklist steps, complete onboarding, activate/deactivate |
| `stores/store-admin.controller.spec.ts` | 4 | CRUD + onboarding endpoints |

**Total: ≥ 38 new tests**

### 11.2 Key Test Scenarios

1. **C&C lifecycle:** PENDING → PREPARING → READY → COLLECTED with correct timestamps
2. **C&C expiry:** Order not collected within 72h → auto-cancelled, inventory released
3. **C&C eligible stores:** Only stores with all requested products in stock returned
4. **Product campaign matching:** Campaign with `fandomFilter: ['Harry Potter']` matches HP product
5. **Product campaign cap:** `maxRedemptions` hit → campaign auto-completes
6. **Onboarding steps:** Marking all steps complete → status changes to COMPLETED
7. **Store activation:** Only stores with completed onboarding can be activated
8. **Currency expansion:** Supported currencies list includes all 8 currencies

---

## 12. MIGRATION & SEED SCRIPT

### 12.1 Migration

File: `services/api/prisma/migrations/20261001000000_phase10_advanced_global/migration.sql`

### 12.2 Seed

Create `services/api/prisma/seeds/phase10-seed.ts`:

Seeds:
1. Ensure all existing stores have `defaultRegionCode` and `loyaltyRedeemValue` set
2. Create onboarding checklists for any existing stores
3. Seed a sample product campaign ("Double Points on Harry Potter Wands" — DRAFT)
4. Seed a C&C notification journey (`click-collect-ready`)

Add to `package.json`:
```json
"db:seed-phase10": "ts-node prisma/seeds/phase10-seed.ts"
```

---

## 13. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Customer can choose PICKUP_IN_STORE at checkout | Shipping method type available, C&C record created |
| 2 | Eligible stores returned based on product stock | GET stores with product IDs → filtered list |
| 3 | Admin can progress C&C order through lifecycle | PENDING → PREPARING → READY → COLLECTED |
| 4 | Customer notified when order is ready | CLICK_COLLECT_READY event → email/push sent |
| 5 | Stale C&C orders auto-expire | Cron runs → orders past 72h cancelled |
| 6 | Product campaign awards bonus points | Purchase qualifying product → extra points earned |
| 7 | Product campaign respects maxRedemptions cap | Cap reached → campaign auto-completes |
| 8 | Product campaigns filterable by fandom/category | Campaign with fandomFilter matches products |
| 9 | Admin can create a new store | POST /admin/stores → store created |
| 10 | Onboarding checklist tracks setup progress | Steps marked → progress visible |
| 11 | Only fully onboarded stores can be activated | Activate without completed checklist → rejected |
| 12 | Supported currencies expanded to 8 | GET currencies → includes GBP, USD, EUR, AED, JPY, AUD, CAD, SGD |
| 13 | Store has region-specific redeem value | NYC store: 100 pts = $1.00, London store: 100 pts = £1.00 |
| 14 | Admin sidebar shows C&C, Product Campaigns, Stores | Verify menu items |
| 15 | 8 new admin pages render without errors | Visit each page → content displayed |
| 16 | 26 API client methods defined | Grep client.ts → 26 new methods |
| 17 | ≥ 38 unit tests passing | `npx jest --testPathPattern="click-collect|product-campaigns|stores"` |
| 18 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 19 | Prisma schema validates | `npx prisma validate` |
| 20 | All existing 270+ tests still pass | Full test suite green |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (3 new models + Store additions + Order relation)
│   ├── migrations/
│   │   └── 20261001000000_phase10_advanced_global/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── phase10-seed.ts                              # NEW
├── src/
│   ├── click-collect/
│   │   ├── click-collect.module.ts                      # NEW
│   │   ├── click-collect.service.ts                     # NEW
│   │   ├── click-collect.service.spec.ts                # NEW
│   │   ├── click-collect.controller.ts                  # NEW (admin)
│   │   ├── click-collect.controller.spec.ts             # NEW
│   │   ├── click-collect-customer.controller.ts         # NEW (customer)
│   │   ├── dto/
│   │   │   └── create-click-collect.dto.ts              # NEW
│   │   └── jobs/
│   │       └── click-collect.jobs.ts                    # NEW
│   ├── product-campaigns/
│   │   ├── product-campaigns.module.ts                  # NEW
│   │   ├── product-campaigns.service.ts                 # NEW
│   │   ├── product-campaigns.service.spec.ts            # NEW
│   │   ├── product-campaigns.controller.ts              # NEW
│   │   ├── product-campaigns.controller.spec.ts         # NEW
│   │   ├── dto/
│   │   │   ├── create-product-campaign.dto.ts           # NEW
│   │   │   └── update-product-campaign.dto.ts           # NEW
│   │   └── jobs/
│   │       └── product-campaign.jobs.ts                 # NEW
│   ├── stores/
│   │   ├── store-admin.module.ts                        # NEW
│   │   ├── store-onboarding.service.ts                  # NEW
│   │   ├── store-onboarding.service.spec.ts             # NEW
│   │   ├── store-admin.controller.ts                    # NEW
│   │   ├── store-admin.controller.spec.ts               # NEW
│   │   └── dto/
│   │       └── create-store.dto.ts                      # NEW
│   ├── currency/
│   │   └── currency.service.ts                          # MODIFIED (expand supported currencies)
│   ├── loyalty/
│   │   └── engines/
│   │       └── earn.engine.ts                           # MODIFIED (product campaign bonus integration)
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (4 new job types)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED
│   └── app.module.ts                                    # MODIFIED (3 new modules)
├── package.json                                         # MODIFIED (seed script)

apps/web/src/
├── app/
│   └── admin/
│       ├── click-collect/
│       │   ├── page.tsx                                 # NEW — C&C order list
│       │   └── [id]/
│       │       └── page.tsx                             # NEW — C&C detail + actions
│       ├── product-campaigns/
│       │   ├── page.tsx                                 # NEW — campaign list
│       │   ├── new/
│       │   │   └── page.tsx                             # NEW — new campaign form
│       │   └── [id]/
│       │       └── page.tsx                             # NEW — campaign detail
│       └── stores/
│           ├── page.tsx                                 # NEW — store list + onboarding
│           ├── new/
│           │   └── page.tsx                             # NEW — new store form
│           └── [id]/
│               └── page.tsx                             # NEW — store detail + checklist
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — 3 new sidebar sections

packages/api-client/src/
└── client.ts                                            # MODIFIED (26 new methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add `ClickCollectOrder`, `ProductCampaign`, `StoreOnboardingChecklist`; extend `Store` and `Order`; run migration; regenerate Prisma
2. **JobType additions** — 4 new job types
3. **Store onboarding service** — CRUD, checklist, activation logic
4. **Store admin controller** — 8 store endpoints
5. **Store admin module** — Wire module
6. **Click & collect service** — Lifecycle, inventory, notifications, expiry
7. **Click & collect controllers** — Admin (6) + customer (3) endpoints
8. **Click & collect module + jobs** — Wire module, 2 cron jobs
9. **Product campaigns service** — CRUD, activation, matching, earn integration
10. **Product campaigns controller + module + jobs** — 7 endpoints, 2 crons
11. **Earn engine integration** — Add product campaign bonus after brand campaigns
12. **Currency service update** — Expand supported currencies
13. **Env vars** — Add Phase 10 env vars
14. **Wire all 3 modules to app.module.ts**
15. **API Client** — 26 new methods
16. **Frontend** — 8 admin pages + sidebar
17. **Seed script** — Sample data + onboarding checklists
18. **Unit tests** — ≥ 38 tests across 6 spec files
19. **Build verification** — `npx tsc --noEmit && npx jest && npx prisma validate`

---

**End of Phase 10 Build Spec — Final Phase of The Enchanted Circle**
