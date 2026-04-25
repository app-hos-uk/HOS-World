# The Enchanted Circle — Composer 2 Build Specification

## Complete Technical Implementation Guide

**Purpose:** This document is the single source of truth for building The Enchanted Circle loyalty and community ecosystem. Follow it phase by phase, section by section.  
**Architecture:** Modular monolith — all code goes inside the existing `services/api` (NestJS) and `apps/web` (Next.js). No new Railway services, databases, or infrastructure.

---

## TABLE OF CONTENTS

1. [Pre-Build: Codebase Context](#1-pre-build-codebase-context)
2. [Phase 1: Core Loyalty Engine](#2-phase-1-core-loyalty-engine)
3. [Phase 2: POS Integration](#3-phase-2-pos-integration)
4. [Phase 3: Extended Earn Rules & Fandom Profiles](#4-phase-3-extended-earn-rules--fandom-profiles)
5. [Phase 4: Marketing Automation Integration](#5-phase-4-marketing-automation-integration)
6. [Phase 5: Event Management](#6-phase-5-event-management)
7. [Phase 6: Segmentation Engine](#7-phase-6-segmentation-engine)
8. [Phase 7: Ambassador Programme](#8-phase-7-ambassador-programme)
9. [Phase 8: Brand Partnerships](#9-phase-8-brand-partnerships)
10. [Phase 9: Analytics & Reporting](#10-phase-9-analytics--reporting)
11. [Phase 10: Advanced Features](#11-phase-10-advanced-features)

---

## 1. PRE-BUILD: CODEBASE CONTEXT

### Existing Tech Stack
- **Backend:** NestJS 10 at `services/api/` — PostgreSQL via Prisma 6, Redis, BullMQ, Stripe, Meilisearch
- **Frontend:** Next.js 14 (App Router) at `apps/web/` — Tailwind CSS, Headless UI, TanStack Query
- **Mobile:** Expo at `apps/mobile/`
- **Monorepo:** pnpm + Turborepo, shared packages at `packages/`
- **Database schema:** `services/api/prisma/schema.prisma`
- **API client:** `packages/api-client/src/client.ts`

### Key Existing Modules to Understand Before Building
- `services/api/src/orders/` — Order lifecycle. Loyalty earn hooks into order completion.
- `services/api/src/products/` — Product CRUD. Channel assignment extends products.
- `services/api/src/inventory/` — Warehouses, stock locations, reservations, movements. POS sync connects here.
- `services/api/src/cart/` — Cart and checkout. Loyalty redemption integrates here.
- `services/api/src/integrations/` — Provider-based integration framework with encrypted credentials. POS adapters follow this pattern.
- `services/api/src/gamification/` — Existing loyalty points, leaderboards. Will be connected to new loyalty engine.
- `services/api/src/whatsapp/` — Twilio WhatsApp with conversations, templates, webhooks. Marketing automation connects here.
- `services/api/src/influencers/` — Full influencer system with referrals, commissions, campaigns, storefronts. Ambassador programme extends this.
- `services/api/src/notifications/` — Email via Nodemailer + BullMQ queue processing.
- `services/api/src/promotions/` — Promotions and coupons engine. Loyalty redemption generates coupons through this.
- `services/api/src/submissions/` — ProductSubmission pipeline (submitted → procurement → catalogue → marketing → finance → published). HOS retail uses this same flow.

### Key Existing Models in schema.prisma
- `User` — has `loyaltyPoints` (Int), `gamificationPoints`, `level`, `favoriteFandoms` (String[])
- `Customer` — has `loyaltyPoints` (Int), `country`, `currencyPreference`
- `Seller` — has `sellerType` (enum: B2C_SELLER, WHOLESALER, SELLER), `commissionRate`, `vendorStatus`
- `Product` — has `sellerId`, `isPlatformOwned`, `price`, `tradePrice`, `rrp`, `currency`, `sku`, `barcode`, `ean`
- `Store` — placeholder: just `id`, `tenantId`, `name`. Needs major expansion.
- `Order` — has `userId`, `sellerId`, order items with prices
- `Fandom` — has `name`, `slug`, `characters`, `quests`
- `Badge`, `UserBadge`, `Quest`, `UserQuest` — gamification models
- `Promotion`, `Coupon`, `CouponUsage` — promotions engine
- `CustomerGroup` — VIP, WHOLESALE, CORPORATE, STUDENT, SENIOR types
- `ActivityLog` — tracks user actions
- `IntegrationConfig` — provider-based integration with encrypted credentials
- `Warehouse`, `InventoryLocation`, `StockReservation`, `StockMovement`, `StockTransfer` — inventory system
- `ProductSubmission` — seller product submission pipeline
- `VendorProduct` — per-vendor pricing (vendorPrice, platformPrice, costPrice, marginPercent)
- `VolumePricing` — quantity-based price tiers
- `Influencer`, `InfluencerCampaign`, `InfluencerCommission`, `InfluencerPayout`, `Referral` — ambassador/influencer system

### Important Patterns to Follow
- All controllers use `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)` decorators
- All responses use `ApiResponse<T>` from `@hos-marketplace/shared-types`
- All controllers have Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`)
- Background jobs use BullMQ via the existing `QueueService`
- Credentials are encrypted via `EncryptionService` in the integrations module
- Frontend pages use `'use client'` directive and fetch via the API client from `@/lib/api`
- Frontend components use Tailwind CSS with the existing font classes (`font-primary` = Cinzel, `font-secondary` = Lora)

---

## 2. PHASE 1: CORE LOYALTY ENGINE

### 2.1 Prisma Schema Changes

Add ALL of the following to `services/api/prisma/schema.prisma`:

**Step 1: Modify SellerType enum — add PLATFORM_RETAIL:**

```prisma
enum SellerType {
  B2C_SELLER
  WHOLESALER
  SELLER
  PLATFORM_RETAIL  // NEW — House of Spells itself
}
```

**Step 2: Add loyalty fields to Seller model:**

Add these fields to the existing `model Seller`:
```
loyaltyEnabled       Boolean  @default(false)
loyaltyEarnRate      Decimal? @db.Decimal(5, 4) // Custom earn rate. Null = platform default
loyaltyFundingModel  String   @default("SELLER_FUNDED") // SELLER_FUNDED or PLATFORM_FUNDED
```

**Step 3: Add loyalty fields to Order model:**

Add these fields to the existing `model Order`:
```
loyaltyPointsEarned     Int      @default(0)
loyaltyPointsRedeemed   Int      @default(0)
loyaltyDiscountAmount   Decimal? @db.Decimal(10, 2)
loyaltyRedemptionChannel String?  // MARKETPLACE_CHECKOUT or HOS_OUTLET_POS
```

**Step 4: Create new models:**

```prisma
// === LOYALTY TIER ===
model LoyaltyTier {
  id               String   @id @default(uuid())
  name             String   @unique
  slug             String   @unique
  level            Int      @unique // 1=Initiate, 2=Spellcaster, ... 6=Council of Realms
  pointsThreshold  Int      // Min lifetime points to qualify
  multiplier       Decimal  @db.Decimal(3, 2) // Earning multiplier: 1.00, 1.25, 1.50, 2.00, 2.50, 3.00
  spendWeight      Decimal  @default(0.50) @db.Decimal(3, 2) // Weight for composite score
  frequencyWeight  Decimal  @default(0.25) @db.Decimal(3, 2)
  engagementWeight Decimal  @default(0.25) @db.Decimal(3, 2)
  benefits         Json     // { freeShipping, shippingType, earlyAccessHours, eventAccess, personalShopper, ... }
  icon             String?
  color            String?  // Hex color for UI
  inviteOnly       Boolean  @default(false)
  maxMembers       Int?     // Null = unlimited
  isActive         Boolean  @default(true)
  members          LoyaltyMembership[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@map("loyalty_tiers")
}

// === LOYALTY MEMBERSHIP (one per user) ===
model LoyaltyMembership {
  id                String   @id @default(uuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tierId            String
  tier              LoyaltyTier @relation(fields: [tierId], references: [id])
  totalPointsEarned Int      @default(0)   // Lifetime earned (determines tier)
  currentBalance    Int      @default(0)   // Spendable balance
  totalPointsRedeemed Int    @default(0)   // Lifetime redeemed
  compositeScore    Decimal  @default(0) @db.Decimal(10, 2) // Weighted score for tier calculation
  totalSpend        Decimal  @default(0) @db.Decimal(10, 2)
  purchaseCount     Int      @default(0)
  engagementCount   Int      @default(0)   // Non-purchase earn actions
  tierExpiresAt     DateTime?              // Annual tier review date
  cardNumber        String?  @unique       // Physical/digital card number (e.g., HOS-XXXX-XXXX)
  enrolledAt        DateTime @default(now())
  enrollmentChannel String   @default("WEB") // WEB, MOBILE, STORE_{code}
  preferredCurrency String   @default("GBP")
  regionCode        String   @default("GB") // ISO country code
  fandomProfile     Json?    // Computed: { "Harry Potter": 0.72, "Anime": 0.45, ... }
  optInEmail        Boolean  @default(true)
  optInSms          Boolean  @default(false)
  optInWhatsApp     Boolean  @default(false)
  optInPush         Boolean  @default(false)
  transactions      LoyaltyTransaction[]
  redemptions       LoyaltyRedemption[]
  referralsGiven    LoyaltyReferral[] @relation("LoyaltyReferrer")
  referralsReceived LoyaltyReferral[] @relation("LoyaltyReferee")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tierId])
  @@index([cardNumber])
  @@index([totalPointsEarned])
  @@index([compositeScore])
  @@map("loyalty_memberships")
}

// === LOYALTY TRANSACTION (full audit trail) ===
model LoyaltyTransaction {
  id              String          @id @default(uuid())
  membershipId    String
  membership      LoyaltyMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  type            LoyaltyTxType   // EARN, BURN, EXPIRE, ADJUST, BONUS
  points          Int             // Positive for earn, negative for burn/expire
  balanceBefore   Int
  balanceAfter    Int
  source          String          // PURCHASE, REVIEW, REFERRAL, QUEST, BIRTHDAY, CHECK_IN, SOCIAL_SHARE, SIGNUP, PROFILE, QUIZ, ANNIVERSARY, EVENT, ADMIN
  sourceId        String?         // orderId, reviewId, questId, eventId, etc.
  channel         String          // WEB, MOBILE, STORE_{code}, SYSTEM
  storeId         String?         // Physical store ID if applicable
  sellerId        String?         // Which seller's product triggered this earn
  description     String?
  earnRuleId      String?         // Which earn rule was applied
  campaignId      String?         // If a bonus campaign was active
  expiresAt       DateTime?       // When these points expire
  metadata        Json?           // Additional context
  createdAt       DateTime        @default(now())

  @@index([membershipId])
  @@index([type])
  @@index([source])
  @@index([channel])
  @@index([createdAt])
  @@index([expiresAt])
  @@map("loyalty_transactions")
}

enum LoyaltyTxType {
  EARN
  BURN
  EXPIRE
  ADJUST
  BONUS
  TRANSFER
}

// === LOYALTY EARN RULE ===
model LoyaltyEarnRule {
  id              String   @id @default(uuid())
  name            String
  action          String   @unique // PURCHASE, REVIEW, PHOTO_REVIEW, SOCIAL_SHARE, REFERRAL_REFERRER, REFERRAL_REFEREE, SIGNUP, PROFILE_COMPLETE, QUEST, BIRTHDAY, CHECK_IN, QUIZ, ANNIVERSARY, EVENT_ATTENDANCE
  pointsAmount    Int      // Base points to award
  pointsType      String   @default("FIXED") // FIXED (flat amount) or PER_CURRENCY_UNIT (per £1/$1 spent)
  multiplierStack Boolean  @default(true)     // Whether tier multiplier applies on top
  maxPerDay       Int?     // Max times this can be triggered per day
  maxPerMonth     Int?
  maxPerUser      Int?     // Lifetime limit per user
  conditions      Json?    // Additional conditions: { minOrderValue, productCategories, fandoms }
  regionCodes     String[] @default([])       // Empty = all regions
  isActive        Boolean  @default(true)
  startsAt        DateTime?
  endsAt          DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("loyalty_earn_rules")
}

// === LOYALTY REDEMPTION OPTION (reward catalogue) ===
model LoyaltyRedemptionOption {
  id              String   @id @default(uuid())
  name            String
  type            String   // DISCOUNT, FREE_SHIPPING, PRODUCT_UNLOCK, RAFFLE, GIFT_CARD, EXPERIENCE, CHARITY, EARLY_ACCESS
  pointsCost      Int
  value           Decimal? @db.Decimal(10, 2) // Monetary value if applicable
  description     String?  @db.Text
  image           String?
  stock           Int?     // Null = unlimited
  regionCodes     String[] @default([])
  isActive        Boolean  @default(true)
  startsAt        DateTime?
  endsAt          DateTime?
  redemptions     LoyaltyRedemption[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("loyalty_redemption_options")
}

// === LOYALTY REDEMPTION (record of each redemption event) ===
model LoyaltyRedemption {
  id              String   @id @default(uuid())
  membershipId    String
  membership      LoyaltyMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  optionId        String
  option          LoyaltyRedemptionOption @relation(fields: [optionId], references: [id])
  pointsSpent     Int
  status          String   @default("COMPLETED") // COMPLETED, PENDING, CANCELLED, REFUNDED
  couponCode      String?  // Generated coupon code if applicable
  channel         String   // MARKETPLACE_CHECKOUT or HOS_OUTLET_POS
  storeId         String?  // If redeemed at a physical store
  orderId         String?  // Linked order
  metadata        Json?
  createdAt       DateTime @default(now())

  @@index([membershipId])
  @@index([channel])
  @@map("loyalty_redemptions")
}

// === LOYALTY REFERRAL ===
model LoyaltyReferral {
  id              String   @id @default(uuid())
  referrerId      String
  referrer        LoyaltyMembership @relation("LoyaltyReferrer", fields: [referrerId], references: [id])
  refereeId       String?
  referee         LoyaltyMembership? @relation("LoyaltyReferee", fields: [refereeId], references: [id])
  referralCode    String   @unique
  status          String   @default("PENDING") // PENDING, CONVERTED, EXPIRED
  referrerPoints  Int      @default(500)
  refereePoints   Int      @default(200)
  convertedAt     DateTime?
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  @@index([referralCode])
  @@map("loyalty_referrals")
}

// === LOYALTY BONUS CAMPAIGN ===
model LoyaltyBonusCampaign {
  id              String   @id @default(uuid())
  name            String
  description     String?  @db.Text
  type            String   // DOUBLE_POINTS, BONUS_POINTS, CATEGORY_BOOST, FANDOM_BOOST
  multiplier      Decimal? @db.Decimal(3, 2) // e.g. 2.00 for double points
  bonusPoints     Int?     // Flat bonus points per transaction
  conditions      Json?    // { fandoms, categories, minSpend, tierIds, sellerIds }
  regionCodes     String[] @default([])
  channelCodes    String[] @default([]) // WEB, MOBILE, STORE
  isActive        Boolean  @default(true)
  startsAt        DateTime
  endsAt          DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([isActive, startsAt, endsAt])
  @@map("loyalty_bonus_campaigns")
}

// === PRODUCT CHANNEL (availability + pricing per channel) ===
model ProductChannel {
  id              String   @id @default(uuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  channelType     String   // ONLINE, STORE
  storeId         String?  // If STORE, which outlet. Null for ONLINE.
  store           Store?   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  currency        String   // GBP, USD, EUR, etc.
  sellingPrice    Decimal  @db.Decimal(10, 2) // Customer-facing price on this channel
  costPrice       Decimal? @db.Decimal(10, 2) // Cost price (for margin)
  compareAtPrice  Decimal? @db.Decimal(10, 2) // Strikethrough "was" price
  marginPercent   Decimal? @db.Decimal(5, 4)
  batchReference  String?  // Procurement batch
  effectiveFrom   DateTime @default(now())
  effectiveUntil  DateTime?
  isActive        Boolean  @default(true)
  assignedBy      String?
  notes           String?  @db.Text

  @@unique([productId, channelType, storeId, currency, effectiveFrom])
  @@index([productId])
  @@index([channelType])
  @@index([storeId])
  @@index([isActive])
  @@map("product_channels")
}

// === POS CONNECTION (per seller/outlet) ===
model POSConnection {
  id                String   @id @default(uuid())
  sellerId          String
  seller            Seller   @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  storeId           String   @unique
  store             Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  provider          String   // lightspeed, square, shopify_pos, clover, etc.
  credentials       String   // Encrypted JSON (use EncryptionService)
  externalOutletId  String?  // Outlet ID in the external POS system
  externalRegisterId String?
  isActive          Boolean  @default(true)
  lastSyncedAt      DateTime?
  syncStatus        String   @default("NEVER_SYNCED") // HEALTHY, ERROR, NEVER_SYNCED
  syncError         String?  @db.Text
  settings          Json?    // Provider-specific settings
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([sellerId, storeId])
  @@index([provider])
  @@index([isActive])
  @@map("pos_connections")
}

// === EXTERNAL ENTITY MAPPING (link HOS IDs to POS IDs) ===
model ExternalEntityMapping {
  id             String   @id @default(uuid())
  provider       String   // lightspeed, square, etc.
  entityType     String   // PRODUCT, CUSTOMER, OUTLET, SALE
  internalId     String   // HOS entity ID
  externalId     String   // POS entity ID
  storeId        String?  // For per-store mappings
  metadata       Json?
  lastSyncedAt   DateTime?
  syncStatus     String   @default("SYNCED") // SYNCED, PENDING, ERROR
  syncError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([provider, entityType, internalId, storeId])
  @@unique([provider, entityType, externalId, storeId])
  @@index([provider, entityType])
  @@index([syncStatus])
  @@map("external_entity_mappings")
}
```

**Step 5: Expand Store model — replace existing placeholder:**

Replace the existing `model Store` entirely with:
```prisma
model Store {
  id                String   @id @default(uuid())
  tenantId          String
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sellerId          String
  seller            Seller   @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  name              String
  code              String   @unique   // HOS-UK-LON-SOHO, HOS-US-NYC-TIMES
  storeType         String   @default("STANDARD") // FLAGSHIP, STANDARD, POP_UP, CONCESSION
  address           String?
  city              String?
  state             String?
  country           String   @default("GB")
  postalCode        String?
  latitude          Float?
  longitude         Float?
  timezone          String   @default("Europe/London")
  currency          String   @default("GBP")
  contactEmail      String?
  contactPhone      String?
  managerName       String?
  operatingHours    Json?    // { mon: { open: "09:00", close: "18:00" }, ... }
  isActive          Boolean  @default(true)
  openedAt          DateTime?

  configs           Config[] @relation("StoreConfigs")
  posConnection     POSConnection?
  productChannels   ProductChannel[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId])
  @@index([sellerId])
  @@index([country])
  @@index([code])
  @@map("stores")
}
```

**Step 6: Add relations to existing models:**

Add to `model User`:
```
loyaltyMembership  LoyaltyMembership?
```

Add to `model Product`:
```
channels           ProductChannel[]
```

Add to `model Seller`:
```
stores             Store[]
posConnections     POSConnection[]
```

**Step 7: Add notification types to `enum NotificationType`:**
```
LOYALTY_POINTS_EARNED
LOYALTY_TIER_UPGRADE
LOYALTY_TIER_DOWNGRADE
LOYALTY_POINTS_EXPIRING
LOYALTY_REDEMPTION
LOYALTY_WELCOME
EVENT_INVITATION
EVENT_REMINDER
```

### 2.2 Seed Data

After running the migration, create a seed script at `services/api/prisma/seeds/loyalty-seed.ts`:

**Seed the 6 tiers:**

| level | name | slug | pointsThreshold | multiplier | inviteOnly |
|-------|------|------|-----------------|------------|------------|
| 1 | Initiate | initiate | 0 | 1.00 | false |
| 2 | Spellcaster | spellcaster | 1000 | 1.25 | false |
| 3 | Enchanter | enchanter | 3000 | 1.50 | false |
| 4 | Dragon Keeper | dragon-keeper | 7500 | 2.00 | false |
| 5 | Archmage Circle | archmage-circle | 15000 | 2.50 | false |
| 6 | Council of Realms | council-of-realms | 0 | 3.00 | true |

Tier benefits JSON examples:
- Initiate: `{ "freeShipping": false, "earlyAccessHours": 0, "eventAccess": false, "personalShopper": false }`
- Dragon Keeper: `{ "freeShipping": true, "shippingType": "worldwide", "earlyAccessHours": 48, "eventAccess": true, "personalShopper": false, "exclusiveProducts": true }`
- Council of Realms: `{ "freeShipping": true, "shippingType": "worldwide", "earlyAccessHours": 72, "eventAccess": true, "personalShopper": true, "exclusiveProducts": true, "coCreation": true, "dedicatedManager": true }`

**Seed default earn rules:**

| action | name | pointsAmount | pointsType | multiplierStack | maxPerDay | maxPerMonth |
|--------|------|-------------|-----------|----------------|-----------|------------|
| PURCHASE | Purchase Points | 1 | PER_CURRENCY_UNIT | true | null | null |
| SIGNUP | Welcome Bonus | 100 | FIXED | false | null | null |
| PROFILE_COMPLETE | Profile Completion | 50 | FIXED | false | null | null |
| REVIEW | Product Review | 25 | FIXED | false | null | 3 |
| PHOTO_REVIEW | Photo Review | 50 | FIXED | false | null | 3 |
| SOCIAL_SHARE | Social Share | 10 | FIXED | false | 5 | null |
| REFERRAL_REFERRER | Referral (Referrer) | 500 | FIXED | false | null | null |
| REFERRAL_REFEREE | Referral (Referee) | 200 | FIXED | false | null | null |
| QUEST | Quest Completion | 0 | FIXED | false | null | null |
| BIRTHDAY | Birthday Bonus | 200 | FIXED | false | null | null |
| CHECK_IN | Store Check-in | 15 | FIXED | false | 1 | null |
| QUIZ | Fandom Quiz | 25 | FIXED | false | null | 4 |
| ANNIVERSARY | Membership Anniversary | 150 | FIXED | false | null | null |
| EVENT_ATTENDANCE | Event Attendance | 100 | FIXED | false | null | null |

**Seed the HOS Platform Retail seller:**

Create a Seller record:
- `storeName`: "House of Spells Official"
- `slug`: "house-of-spells-official"
- `sellerType`: PLATFORM_RETAIL
- `country`: "GB"
- `verified`: true
- `vendorStatus`: APPROVED
- `loyaltyEnabled`: true
- `loyaltyFundingModel`: "PLATFORM_FUNDED"
- `commissionRate`: 0

Store the created seller's ID as `HOS_SELLER_ID` in environment variables.

**Seed default redemption options:**

| name | type | pointsCost | value |
|------|------|-----------|-------|
| £1 Discount | DISCOUNT | 100 | 1.00 |
| £5 Discount | DISCOUNT | 500 | 5.00 |
| £10 Discount | DISCOUNT | 1000 | 10.00 |
| Free Shipping Upgrade | FREE_SHIPPING | 200 | null |
| Raffle Entry | RAFFLE | 50 | null |
| £5 Gift Card | GIFT_CARD | 500 | 5.00 |
| £1 Charity Donation | CHARITY | 100 | 1.00 |
| Early Access Pass | EARLY_ACCESS | 300 | null |

**Migrate existing loyalty points:**

Write a data migration that:
1. Queries all `User` records with `loyaltyPoints > 0`
2. Creates `LoyaltyMembership` records for each, setting `totalPointsEarned = loyaltyPoints`, `currentBalance = loyaltyPoints`
3. Assigns appropriate tier based on points
4. Creates an initial `LoyaltyTransaction` of type `ADJUST` with description "Migrated from legacy system"

### 2.3 Backend Module Structure

Create `services/api/src/loyalty/` with:

```
loyalty/
├── loyalty.module.ts            — NestJS module, imports PrismaModule, QueueModule
├── loyalty.controller.ts        — Customer-facing REST endpoints
├── loyalty-admin.controller.ts  — Admin REST endpoints
├── loyalty.service.ts           — Core orchestration service
├── engines/
│   ├── earn.engine.ts           — Points earning logic
│   ├── burn.engine.ts           — Redemption logic
│   ├── tier.engine.ts           — Tier calculation + upgrade/downgrade
│   └── expiry.engine.ts         — Points expiration logic
├── services/
│   ├── wallet.service.ts        — Balance management + transaction logging
│   ├── referral.service.ts      — Referral code generation + tracking
│   └── campaign.service.ts      — Bonus campaign management
├── listeners/
│   └── loyalty.listener.ts      — Listens for order.completed, review.created, etc.
├── jobs/
│   ├── tier-review.job.ts       — Nightly tier recalculation (BullMQ)
│   ├── points-expiry.job.ts     — Nightly points expiration (BullMQ)
│   └── birthday-bonus.job.ts    — Daily birthday check (BullMQ)
└── dto/
    ├── enroll.dto.ts
    ├── earn-points.dto.ts
    ├── redeem-points.dto.ts
    ├── lookup-member.dto.ts
    └── loyalty-response.dto.ts
```

### 2.4 Earn Engine Logic

```
processOrderComplete(orderId: string):
  1. Get order with items, each item's product, each product's seller
  2. Get loyalty membership for order.userId (skip if not enrolled)
  3. For each order item:
     a. Get seller = item.product.seller
     b. If seller.loyaltyEnabled == false → skip this item
     c. Get earn rate:
        - If seller.loyaltyEarnRate is set → use it
        - Else → get PURCHASE earn rule default (1 pt per currency unit)
     d. Calculate base points = itemTotal × earnRate
  4. Sum all qualifying item points → basePoints
  5. Get active bonus campaigns matching this order's conditions
  6. Apply bonus campaign multiplier or bonus points
  7. Apply tier multiplier: finalPoints = basePoints × tier.multiplier
  8. Credit points via wallet service (atomic transaction)
  9. Update order.loyaltyPointsEarned = finalPoints
  10. Update membership: totalPointsEarned, totalSpend, purchaseCount
  11. Check if tier upgrade is needed (call tier engine)
```

### 2.5 Burn Engine Logic — CRITICAL RULE

```
processRedemption(memberId, points, channel, storeId?, optionId?):
  1. VALIDATE CHANNEL:
     - channel MUST be "MARKETPLACE_CHECKOUT" or "HOS_OUTLET_POS"
     - If "HOS_OUTLET_POS": verify store exists AND store.seller.sellerType == "PLATFORM_RETAIL"
     - ANY other channel → REJECT with "Redemption not available on this channel"
  2. VALIDATE BALANCE:
     - membership.currentBalance >= points
  3. VALIDATE OPTION (if optionId provided):
     - Option exists, isActive, has stock (or unlimited), region matches
  4. PROCESS (atomic DB transaction):
     - Deduct points from membership.currentBalance
     - Increment membership.totalPointsRedeemed
     - Create LoyaltyTransaction (type: BURN, negative points)
     - Create LoyaltyRedemption record
     - If type == DISCOUNT: generate coupon code via Promotions service
     - Return { success, couponCode, discountAmount }
```

### 2.6 Tier Engine Logic

```
recalculateTier(membershipId):
  1. Get membership with all stats
  2. Calculate composite score:
     compositeScore = (totalSpend × spendWeight) + (purchaseCount × frequencyWeight × 100) + (engagementCount × engagementWeight × 50)
  3. Find appropriate tier:
     - Get all tiers ordered by level DESC
     - For each tier (highest first):
       - Skip if inviteOnly == true (can't auto-upgrade to invite-only)
       - If totalPointsEarned >= tier.pointsThreshold → this is the tier
  4. If new tier != current tier:
     - Update membership.tierId
     - Create notification (LOYALTY_TIER_UPGRADE or LOYALTY_TIER_DOWNGRADE)
     - Log activity
```

### 2.7 REST API Endpoints

**Customer endpoints (loyalty.controller.ts):**

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | /api/v1/loyalty/enroll | Join The Enchanted Circle | @Roles('CUSTOMER') |
| GET | /api/v1/loyalty/membership | Get membership, balance, tier | @Roles('CUSTOMER') |
| GET | /api/v1/loyalty/transactions | Transaction history (paginated, filterable) | @Roles('CUSTOMER') |
| GET | /api/v1/loyalty/tier-progress | Progress % to next tier | @Roles('CUSTOMER') |
| GET | /api/v1/loyalty/redemption-options | Available rewards | @Roles('CUSTOMER') |
| POST | /api/v1/loyalty/redeem | Redeem points | @Roles('CUSTOMER') |
| GET | /api/v1/loyalty/referral | Get referral code + stats | @Roles('CUSTOMER') |
| POST | /api/v1/loyalty/referral/generate | Generate referral code | @Roles('CUSTOMER') |
| GET | /api/v1/loyalty/card | Digital card data (QR payload) | @Roles('CUSTOMER') |
| POST | /api/v1/loyalty/check-in | Store visit QR check-in | @Roles('CUSTOMER') |

**POS/Service endpoints:**

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | /api/v1/loyalty/lookup | Lookup member by card/email/phone | @Roles('ADMIN') or service key |

**Admin endpoints (loyalty-admin.controller.ts):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/v1/admin/loyalty/dashboard | Programme KPI overview |
| GET/PUT | /api/v1/admin/loyalty/tiers/:id | Manage tiers |
| CRUD | /api/v1/admin/loyalty/earn-rules | Manage earn rules |
| CRUD | /api/v1/admin/loyalty/redemption-options | Manage reward catalogue |
| CRUD | /api/v1/admin/loyalty/campaigns | Manage bonus campaigns |
| GET | /api/v1/admin/loyalty/members | Search members |
| GET | /api/v1/admin/loyalty/members/:id | View member detail |
| POST | /api/v1/admin/loyalty/adjust | Manual point adjustment |
| GET | /api/v1/admin/loyalty/transactions | All transactions (audit) |

### 2.8 Checkout Integration

Modify `services/api/src/cart/cart.service.ts`:
- Add `applyLoyaltyRedemption(cartId, points)` method
- Validates the redemption via burn engine (channel = MARKETPLACE_CHECKOUT)
- Stores pending redemption on the cart
- On order creation: finalize the redemption, deduct points, apply discount

Modify `services/api/src/orders/orders.service.ts`:
- After order completion: call `earnEngine.processOrderComplete(orderId)`
- Set `order.loyaltyPointsEarned` and `order.loyaltyPointsRedeemed`

### 2.9 Product Channel Service

Create `services/api/src/channels/`:
```
channels/
├── channels.module.ts
├── channels.service.ts     — Assign/remove products to channels, manage channel pricing
├── channels.controller.ts  — Admin API
└── dto/
    ├── assign-channel.dto.ts
    └── update-channel-price.dto.ts
```

**Key methods:**
- `assignProductToChannel(productId, channelType, storeId?, currency, sellingPrice, costPrice?)`
- `removeProductFromChannel(productChannelId)`
- `updateChannelPrice(productChannelId, sellingPrice, costPrice?, compareAtPrice?)`
- `getProductChannels(productId)` — all channel assignments for a product
- `getStoreProducts(storeId)` — all products assigned to a store
- `resolvePrice(productId, channelType, storeId?, currency)` — get the active price for a specific context

**Price resolution logic:**
1. Look for `ProductChannel` where productId, channelType, storeId, currency match, effectiveFrom <= now, effectiveUntil is null or > now, isActive = true
2. If found → return sellingPrice
3. If not found → fall back to `Product.price` with currency conversion via `CurrencyExchangeRate`

### 2.10 Frontend Pages

**Customer pages in `apps/web/src/app/`:**
- `loyalty/page.tsx` — Dashboard: balance, tier badge, progress bar, recent transactions, "Ways to earn"
- `loyalty/rewards/page.tsx` — Redemption catalogue grid
- `loyalty/referral/page.tsx` — Referral code, share links, referral stats
- `loyalty/card/page.tsx` — Digital loyalty card with QR code

**Admin pages in `apps/web/src/app/admin/`:**
- `loyalty/page.tsx` — Programme dashboard (total members, points issued/redeemed, tier distribution chart, programme cost)
- `loyalty/tiers/page.tsx` — View/edit tier configuration
- `loyalty/earn-rules/page.tsx` — Manage earn rules
- `loyalty/redemptions/page.tsx` — Manage reward catalogue
- `loyalty/campaigns/page.tsx` — Create/manage bonus campaigns
- `loyalty/members/page.tsx` — Search members, view profiles
- `loyalty/transactions/page.tsx` — Transaction audit trail

**Components in `apps/web/src/components/loyalty/`:**
- `TierBadge.tsx` — Tier icon + name display
- `PointsBalance.tsx` — Current balance
- `TierProgress.tsx` — Progress bar to next tier
- `LoyaltyCard.tsx` — Digital card with QR
- `PointsHistory.tsx` — Transaction list
- `RedemptionCatalogue.tsx` — Available rewards
- `EarnActions.tsx` — "Ways to earn" panel
- `ReferralWidget.tsx` — Referral code + sharing
- `LoyaltyCheckoutWidget.tsx` — Points redemption UI at checkout

**Modify existing pages:**
- `checkout/page.tsx` — Add `LoyaltyCheckoutWidget` for points redemption
- `customer/dashboard/page.tsx` — Add loyalty summary card
- `profile/page.tsx` — Show Enchanted Circle membership
- `admin/dashboard/page.tsx` — Add loyalty KPI widgets

### 2.11 Background Jobs (BullMQ)

Register these in `loyalty.module.ts` via the existing `QueueService`:

| Job | Schedule | Logic |
|-----|----------|-------|
| `loyalty:tier-review` | Daily 3:00 AM UTC | Recalculate composite scores for all members, process upgrades/downgrades |
| `loyalty:points-expiry` | Daily 4:00 AM UTC | Expire points older than 24 months (where region allows), create EXPIRE transactions |
| `loyalty:expiry-warning` | Weekly Monday 9:00 AM UTC | Find members with points expiring in 30 days, create notification |
| `loyalty:birthday-bonus` | Daily 6:00 AM UTC | Find members with birthday today, award birthday points |
| `loyalty:anniversary-bonus` | Daily 6:30 AM UTC | Find members with enrollment anniversary today, award points |

### 2.12 Environment Variables

```
HOS_SELLER_ID=                         # Set after seeding HOS seller
LOYALTY_ENABLED=false                  # Feature flag
LOYALTY_POINTS_EXPIRY_MONTHS=24
LOYALTY_DEFAULT_EARN_RATE=1
LOYALTY_DEFAULT_REDEEM_VALUE=0.01      # 1 point = £0.01
LOYALTY_MIN_REDEMPTION_POINTS=100
LOYALTY_CARD_PREFIX=HOS
```

### 2.13 Tests to Write

**Unit tests (90% coverage target):**
- Earn engine: points calculation per action, tier multiplier, frequency limits, bonus campaigns, seller opt-in check
- Burn engine: redemption validation, channel scope enforcement (CRITICAL: test that non-HOS channels are rejected), coupon generation
- Tier engine: composite score calculation, upgrade/downgrade logic, invite-only protection
- Wallet service: balance updates, transaction logging, atomicity

**Integration tests:**
- Full enrollment → earn → redeem → tier upgrade lifecycle
- Order completion → correct points with tier multiplier
- Checkout with redemption: points deducted + discount applied + new points on remainder
- Mixed order (HOS product + opted-in seller + non-opted-in seller): only qualifying items earn
- Redemption channel enforcement: marketplace checkout = allowed, HOS POS = allowed, anything else = rejected

---

## 3. PHASE 2: POS INTEGRATION

### 3.1 POS Adapter Interface

Create `services/api/src/pos/interfaces/pos-adapter.interface.ts`:

Define the generic POS adapter contract:

```typescript
interface POSAdapter {
  readonly providerName: string;

  // Authentication
  authenticate(credentials: Record<string, any>): Promise<void>;
  refreshAuth(): Promise<void>;

  // Outlets
  getOutlets(): Promise<POSOutlet[]>;

  // Products
  syncProduct(product: POSProductPayload, outletId: string): Promise<string>; // returns external ID
  removeProduct(externalId: string, outletId: string): Promise<void>;

  // Inventory
  getInventory(externalProductId: string, outletId: string): Promise<number>;
  updateInventory(externalProductId: string, outletId: string, quantity: number): Promise<void>;

  // Customers
  syncCustomer(customer: POSCustomerPayload): Promise<string>; // returns external ID
  lookupCustomer(identifier: string): Promise<POSCustomer | null>; // by email or phone

  // Sales
  getSales(since: Date, outletId?: string): Promise<POSSale[]>;

  // Webhooks
  validateWebhook(payload: any, signature: string, secret: string): boolean;
  parseWebhookSale(payload: any): POSSale;
}
```

Define shared types in `pos-types.ts`: `POSOutlet`, `POSProductPayload`, `POSCustomerPayload`, `POSCustomer`, `POSSale`, `POSSaleItem`.

Create `pos-adapter.factory.ts`: given provider name string, returns the correct adapter instance. Throw descriptive error if adapter not implemented.

### 3.2 Lightspeed Adapter

Create `services/api/src/pos/adapters/lightspeed/`:
- `lightspeed.adapter.ts` — implements POSAdapter for Lightspeed X-Series REST API
- `lightspeed-auth.service.ts` — OAuth2 token management, auto-refresh
- `lightspeed-api.client.ts` — HTTP client with rate limiting (bucket-based), retry with exponential backoff
- `lightspeed.mapper.ts` — bidirectional data transformation (HOS ↔ Lightspeed)

**Product mapping (HOS → Lightspeed):**
- `product.name` → `name`
- `product.sku` → `sku` (linking key)
- Channel-specific `sellingPrice` → `retail_price`
- `costPrice` → `supply_price`
- Product images (first) → `image`
- Category/fandom → `tag` or `product_type`

### 3.3 Sync Services

Create `services/api/src/pos/sync/`:

**product-sync.service.ts:**
- On product update: get all STORE channel assignments → for each store with active POS connection → get adapter → sync product with channel-specific price
- Products WITHOUT a channel assignment for a store are NEVER synced to that store
- Use `ExternalEntityMapping` to track HOS ID ↔ POS ID

**inventory-sync.service.ts:**
- Online sale → decrement POS stock for relevant outlet
- POS sale webhook → decrement HOS inventory (via `InventoryService`)
- Nightly reconciliation: compare HOS vs POS stock per outlet, log discrepancies via existing `DiscrepanciesService`

**customer-sync.service.ts:**
- Push lightweight customer data (name, email, phone) to POS on enrollment
- Lookup customer in POS for matching

**sales-import.service.ts:**
- Import POS sales into HOS for unified reporting
- Each sale triggers loyalty earn if customer is identified

### 3.4 Webhook Controller

Create `services/api/src/pos/webhooks/pos-webhook.controller.ts`:
- `POST /api/v1/pos/webhooks/:provider/:storeCode` — receives POS webhooks
- Validates signature via adapter
- Parses sale via adapter
- Triggers: inventory update + loyalty earn + sales record creation
- MUST be idempotent (deduplicate by external sale ID)

### 3.5 Admin UI

- `apps/web/src/app/admin/pos/page.tsx` — POS connections dashboard
- `apps/web/src/app/admin/pos/connections/page.tsx` — Manage connections
- `apps/web/src/app/admin/pos/sync/page.tsx` — Sync status and manual triggers
- `apps/web/src/app/admin/pos/stores/page.tsx` — Outlet management

---

## 4. PHASE 3: EXTENDED EARN RULES & FANDOM PROFILES

### 4.1 Wire Earn Events

Modify existing services to emit loyalty earn events:

- `services/api/src/products/` — on `ProductReview` creation → call earn engine (REVIEW or PHOTO_REVIEW)
- `services/api/src/social-sharing/` — on share → call earn engine (SOCIAL_SHARE)
- `services/api/src/gamification/` — on quest completion → call earn engine (QUEST) with quest's points
- `apps/web/src/components/FandomQuiz.tsx` — on quiz completion → call earn endpoint (QUIZ)

### 4.2 Referral System

- Generate branded referral codes: `HOS-{FIRST_NAME}-{4_RANDOM_CHARS}`
- Build referral landing page: `apps/web/src/app/ref/[code]/page.tsx` — sets attribution cookie
- On referred user's first order: award referrer 500 pts + referee 200 pts
- Referral dashboard: `apps/web/src/app/loyalty/referral/page.tsx`

### 4.3 Fandom Profile Service

Create `services/api/src/loyalty/services/fandom-profile.service.ts`:
- Data sources: purchase history (order items → products → fandom), wishlist items, `User.favoriteFandoms`, quiz results, quest completions, event attendance
- Compute affinity score per fandom: `{ "Harry Potter": 0.72, "Anime": 0.45, ... }`
- Store on `LoyaltyMembership.fandomProfile` (JSON)
- Recalculate via BullMQ job: weekly

---

## 5. PHASE 4: MARKETING AUTOMATION INTEGRATION

### 5.1 Integration Module

Create `services/api/src/marketing-integration/`:
- `marketing-integration.module.ts`
- `marketing-integration.service.ts` — abstract event emitter
- `providers/customerio.provider.ts` — Customer.io API implementation
- `providers/klaviyo.provider.ts` — Klaviyo API implementation (alternative)

### 5.2 Events to Emit

Fire these to the marketing platform after each action:

| Event | Trigger | Data |
|-------|---------|------|
| `member.enrolled` | Enrollment | name, email, phone, whatsapp, tier, channel |
| `member.tier_upgraded` | Tier change | oldTier, newTier, points |
| `loyalty.points_earned` | Any earn | points, source, balance, tier |
| `loyalty.points_redeemed` | Redemption | pointsSpent, rewardType, balance |
| `loyalty.points_expiring` | 30-day warning | pointsAmount, expiryDate |
| `order.completed` | Order | products, fandoms, amount, channel |
| `store.visited` | QR check-in | storeName, city, country |
| `review.created` | Review submitted | product, rating, fandom |

Use BullMQ queue for reliable delivery with retry on failure.

### 5.3 Environment Variables

```
MARKETING_PLATFORM=customerio
CUSTOMERIO_SITE_ID=
CUSTOMERIO_API_KEY=
CUSTOMERIO_WEBHOOK_SECRET=
```

---

## 6. PHASE 5: EVENT MANAGEMENT

### 6.1 Schema

```prisma
model Event {
  id            String   @id @default(uuid())
  name          String
  description   String?  @db.Text
  type          String   // PRODUCT_LAUNCH, FAN_MEETUP, THEMED_EVENT, VIP_EXPERIENCE
  fandomId      String?
  fandom        Fandom?  @relation(fields: [fandomId], references: [id])
  storeId       String?
  store         Store?   @relation(fields: [storeId], references: [id])
  date          DateTime
  endDate       DateTime?
  capacity      Int?
  minTierLevel  Int      @default(1) // Minimum tier level for access
  image         String?
  isActive      Boolean  @default(true)
  rsvps         EventRSVP[]
  attendances   EventAttendance[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([date])
  @@index([storeId])
  @@index([fandomId])
  @@map("events")
}

model EventRSVP {
  id        String   @id @default(uuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status    String   @default("CONFIRMED") // CONFIRMED, CANCELLED, WAITLISTED
  createdAt DateTime @default(now())

  @@unique([eventId, userId])
  @@map("event_rsvps")
}

model EventAttendance {
  id        String   @id @default(uuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  checkedInAt DateTime @default(now())
  pointsAwarded Int   @default(0)

  @@unique([eventId, userId])
  @@map("event_attendances")
}
```

### 6.2 Module

Create `services/api/src/events/` with CRUD service + controller.
Frontend: `apps/web/src/app/events/page.tsx` (listing) and `apps/web/src/app/events/[id]/page.tsx` (detail + RSVP).
Admin: `apps/web/src/app/admin/events/page.tsx`.

---

## 7. PHASE 6: SEGMENTATION ENGINE

### 7.1 Schema

```prisma
model AudienceSegment {
  id              String   @id @default(uuid())
  name            String
  description     String?  @db.Text
  conditions      Json     // Array of rule objects
  memberCount     Int      @default(0) // Cached count
  lastComputedAt  DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("audience_segments")
}
```

### 7.2 Module

Create `services/api/src/segmentation/`:
- `audience-builder.service.ts` — evaluates rule conditions against member data
- Supported conditions: fandomAffinity, tierLevel, totalSpend, lastPurchaseRecency, country, engagementScore, eventAttendance, productCategory
- Nightly job: recompute all segment memberships
- Admin UI: `apps/web/src/app/admin/segments/page.tsx` — visual segment builder

---

## 8. PHASE 7: AMBASSADOR PROGRAMME

Modify `services/api/src/influencers/`:
- Add tier-based unlock: Dragon Keeper unlocks referral dashboard, Archmage unlocks storefront
- Allow self-service enrollment for qualifying tier members
- Add UGC submission model + moderation flow
- Connect commissions to loyalty wallet (optional: receive as points at bonus rate)

---

## 9. PHASE 8: BRAND PARTNERSHIPS

### 9.1 Schema

```prisma
model BrandPartner {
  id            String   @id @default(uuid())
  companyName   String
  contactName   String?
  contactEmail  String?
  logo          String?
  fandomIds     String[] @default([])
  isActive      Boolean  @default(true)
  campaigns     BrandCampaign[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("brand_partners")
}

model BrandCampaign {
  id              String       @id @default(uuid())
  partnerId       String
  partner         BrandPartner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  name            String
  type            String       // BONUS_POINTS, SPONSORED_PRODUCT, EXCLUSIVE_ACCESS
  targetSegmentId String?
  budget          Decimal?     @db.Decimal(10, 2)
  spent           Decimal      @default(0) @db.Decimal(10, 2)
  bonusCampaignId String?      // Links to LoyaltyBonusCampaign
  startsAt        DateTime
  endsAt          DateTime
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([partnerId])
  @@map("brand_campaigns")
}
```

### 9.2 Module

Create `services/api/src/brand-partnerships/` with CRUD + brand campaign creation that auto-creates a linked `LoyaltyBonusCampaign`.
Admin UI: `apps/web/src/app/admin/brand-partners/page.tsx`.

---

## 10. PHASE 9: ANALYTICS & REPORTING

### 10.1 Metrics Service

Create `services/api/src/loyalty/services/loyalty-analytics.service.ts`:

Computed metrics:
- **CLV:** total spend per member, projected based on tier and recency
- **Repeat purchase rate:** (members with 2+ orders / total members) — compare with non-members
- **AOV comparison:** average order value members vs non-members
- **Programme cost:** total unredeemed points × LOYALTY_DEFAULT_REDEEM_VALUE
- **Redemption rate:** totalPointsRedeemed / totalPointsEarned across all members
- **Tier distribution:** count per tier
- **Fandom trends:** top fandoms by revenue, member count, growth
- **Campaign ROI:** revenue from orders with campaign attribution vs campaign cost

### 10.2 Dashboard

Enhance `apps/web/src/app/admin/loyalty/page.tsx` with:
- KPI cards: total members, points issued, points redeemed, programme cost, avg CLV
- Tier distribution pie chart
- Points issued vs redeemed line chart (monthly)
- Top fandoms bar chart
- Recent activity feed

---

## 11. PHASE 10: ADVANCED FEATURES

### 11.1 Click & Collect

- Add `orderType` field to Order: `DELIVERY`, `CLICK_AND_COLLECT`
- Add `pickupStoreId` to Order
- Checkout flow: customer selects "Pick up in store" → selects store → order confirmed
- Notification to store: "Order #X ready for pickup"
- POS: staff confirms pickup

### 11.2 Product Campaigns

- "Buy this slow-moving product, get 5x points" — link `LoyaltyBonusCampaign` to specific products
- Auto-detect slow-moving inventory: products with stock > threshold and sales < threshold in last 30 days
- Suggest campaign creation to admin

### 11.3 New Outlet Onboarding

Document the 5-day process:
1. Create Store record with full details
2. Create POS connection (Lightspeed or other)
3. Assign products to store channel with local pricing
4. Test loyalty lookup + earn + redeem
5. Staff training + go live

---

## APPENDIX: FEATURE FLAGS

| Flag | Purpose | Default |
|------|---------|---------|
| `LOYALTY_ENABLED` | Master loyalty switch | `false` |
| `LOYALTY_REDEMPTION_AT_CHECKOUT` | Allow checkout redemption | `false` |
| `LOYALTY_POS_ENABLED` | Allow POS loyalty | `false` |
| `POS_SYNC_ENABLED` | Enable POS product/inventory sync | `false` |
| `MARKETING_AUTOMATION_ENABLED` | Enable event pipeline to marketing platform | `false` |

## APPENDIX: MIDDLEWARE UPDATE

Add to `BYPASS_PREFIXES` in `apps/web/src/middleware.ts`:
```
'/loyalty',
'/events',
'/ref',
```

## APPENDIX: API CLIENT UPDATE

Add loyalty methods to `packages/api-client/src/client.ts`:
- `enrollLoyalty()`
- `getLoyaltyMembership()`
- `getLoyaltyTransactions(params)`
- `getLoyaltyTierProgress()`
- `getRedemptionOptions()`
- `redeemPoints(points, channel, optionId?)`
- `getReferralInfo()`
- `generateReferralCode()`
- `getLoyaltyCard()`
- `loyaltyCheckIn(storeId)`
- `lookupLoyaltyMember(query)` // for POS

---

**END OF SPECIFICATION**

*Build each phase in order. After each phase, ensure all tests pass and the feature works end-to-end before proceeding. Commit after each logical unit of work.*
