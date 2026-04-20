# Phase 4 — Marketing Automation Integration: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-4-marketing`  
**Base:** `feature/loyalty-phase-3-earn-fandom` (all Phase 1–3 work merged)  
**Estimated:** 4–5 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Messaging Provider Abstraction](#3-messaging-provider-abstraction)
4. [Journey Engine](#4-journey-engine)
5. [Journey Definitions (Built-in Flows)](#5-journey-definitions-built-in-flows)
6. [Event Bus & Trigger System](#6-event-bus--trigger-system)
7. [Consent-Aware Send Pipeline](#7-consent-aware-send-pipeline)
8. [Abandoned Cart Recovery](#8-abandoned-cart-recovery)
9. [BullMQ Jobs & Scheduling](#9-bullmq-jobs--scheduling)
10. [REST API Endpoints](#10-rest-api-endpoints)
11. [Admin API Endpoints](#11-admin-api-endpoints)
12. [Frontend Pages](#12-frontend-pages)
13. [API Client Extensions](#13-api-client-extensions)
14. [Environment Variables](#14-environment-variables)
15. [Testing Strategy](#15-testing-strategy)
16. [Migration & Seed Script](#16-migration--seed-script)
17. [Acceptance Criteria](#17-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 4, confirm:

- [ ] Phase 1–3 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 80+ loyalty, POS, and quiz tests pass (`npx jest --testPathPattern="(loyalty|pos|quiz)"`)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–3 services are functional:
  - `NotificationsService` (SMTP email via Nodemailer, `EMAIL_NOTIFICATION` job type)
  - `TemplatesService` (email/WhatsApp/SMS/in-app template rendering with `{{var}}` interpolation)
  - `WhatsAppService` (Twilio WhatsApp outbound + inbound webhook)
  - `QueueService` / BullMQ (job queue, repeatable cron, DLQ)
  - `LoyaltyEventService` (`onWelcome`, `onTierChange`, `onPointsEarned`)
  - `LoyaltyListener` (all Phase 3 hooks: review, social, quest, quiz, referral)
  - `LoyaltyJobsService` (birthday bonus, points expiry, tier review, fandom recompute)
- [ ] Existing models to leverage:
  - `Notification` (userId, type, status, email, metadata)
  - `WhatsAppConversation`, `WhatsAppMessage`, `WhatsAppTemplate`
  - `NewsletterSubscription` (email, status, tags)
  - `User.preferredCommunicationMethod`, `User.gdprConsent`, `User.dataProcessingConsent`
  - `LoyaltyMembership.optInEmail`, `optInSms`, `optInPush`, `optInWhatsapp`
  - `Cart.abandonedEmailSentAt`, `Cart.updatedAt`
  - `User.birthday`, `LoyaltyMembership.birthday`

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**MarketingJourney — defines an automated multi-step flow:**

```prisma
model MarketingJourney {
  id            String   @id @default(uuid())
  slug          String   @unique
  name          String
  description   String?  @db.Text
  triggerEvent  String
  triggerConditions Json? // e.g. { "tierSlug": "wizard", "channel": "WEB" }
  steps         Json     // Array of JourneyStep definitions (see §4)
  isActive      Boolean  @default(true)
  regionCodes   String[] @default([])
  channelCodes  String[] @default([])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  enrollments   JourneyEnrollment[]

  @@index([triggerEvent])
  @@index([isActive])
  @@map("marketing_journeys")
}
```

**JourneyEnrollment — tracks a user's progress through a journey:**

```prisma
model JourneyEnrollment {
  id          String   @id @default(uuid())
  journeyId   String
  journey     MarketingJourney @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentStep Int      @default(0)
  status      String   @default("ACTIVE") // ACTIVE, COMPLETED, CANCELLED, PAUSED
  startedAt   DateTime @default(now())
  completedAt DateTime?
  lastStepAt  DateTime?
  nextStepAt  DateTime?
  metadata    Json?

  @@unique([journeyId, userId])
  @@index([userId])
  @@index([status, nextStepAt])
  @@map("journey_enrollments")
}
```

**MessageLog — audit trail for every outbound message (all channels):**

```prisma
model MessageLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel     String   // EMAIL, SMS, WHATSAPP, PUSH, IN_APP
  templateSlug String?
  subject     String?
  status      String   @default("QUEUED") // QUEUED, SENT, DELIVERED, FAILED, BOUNCED
  journeyId   String?
  enrollmentId String?
  providerRef String?  // External message ID from provider
  error       String?  @db.Text
  sentAt      DateTime?
  deliveredAt DateTime?
  openedAt    DateTime?
  clickedAt   DateTime?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([channel, status])
  @@index([journeyId])
  @@index([createdAt])
  @@map("message_logs")
}
```

**PushSubscription — web push / FCM tokens:**

```prisma
model PushSubscription {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint   String   @db.Text
  keys       Json     // { p256dh, auth } for web push, or { fcmToken } for FCM
  platform   String   @default("WEB") // WEB, IOS, ANDROID
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
  @@index([isActive])
  @@map("push_subscriptions")
}
```

### 2.2 Model Additions

**Add to `User` model:**

```prisma
model User {
  // ... existing fields ...
  journeyEnrollments  JourneyEnrollment[]
  messageLogs         MessageLog[]
  pushSubscriptions   PushSubscription[]
  lastLoginAt         DateTime?
}
```

### 2.3 Enum Update

**Extend `NotificationType` to include missing values used by services:**

Add `SYSTEM`, `GENERAL`, `ORDER_REFUNDED`, `SETTLEMENT_COMPLETED`, `PRODUCT_APPROVED`, `PRODUCT_REJECTED` to the `NotificationType` enum if not present.

### 2.4 Manual Migration Script

Create `services/api/prisma/migrations/20260505100000_phase4_marketing_automation/migration.sql`:

```sql
-- Phase 4: Marketing Automation

-- MarketingJourney table
CREATE TABLE IF NOT EXISTS "marketing_journeys" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "triggerConditions" JSONB,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "regionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channelCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_journeys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_journeys_slug_key" ON "marketing_journeys"("slug");
CREATE INDEX IF NOT EXISTS "marketing_journeys_triggerEvent_idx" ON "marketing_journeys"("triggerEvent");
CREATE INDEX IF NOT EXISTS "marketing_journeys_isActive_idx" ON "marketing_journeys"("isActive");

-- JourneyEnrollment table
CREATE TABLE IF NOT EXISTS "journey_enrollments" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastStepAt" TIMESTAMP(3),
    "nextStepAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "journey_enrollments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "journey_enrollments_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "marketing_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "journey_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "journey_enrollments_journeyId_userId_key" ON "journey_enrollments"("journeyId", "userId");
CREATE INDEX IF NOT EXISTS "journey_enrollments_userId_idx" ON "journey_enrollments"("userId");
CREATE INDEX IF NOT EXISTS "journey_enrollments_status_nextStepAt_idx" ON "journey_enrollments"("status", "nextStepAt");

-- MessageLog table
CREATE TABLE IF NOT EXISTS "message_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateSlug" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "journeyId" TEXT,
    "enrollmentId" TEXT,
    "providerRef" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "message_logs_userId_idx" ON "message_logs"("userId");
CREATE INDEX IF NOT EXISTS "message_logs_channel_status_idx" ON "message_logs"("channel", "status");
CREATE INDEX IF NOT EXISTS "message_logs_journeyId_idx" ON "message_logs"("journeyId");
CREATE INDEX IF NOT EXISTS "message_logs_createdAt_idx" ON "message_logs"("createdAt");

-- PushSubscription table
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'WEB',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
CREATE INDEX IF NOT EXISTS "push_subscriptions_isActive_idx" ON "push_subscriptions"("isActive");

-- User additions
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
```

---

## 3. MESSAGING PROVIDER ABSTRACTION

### 3.1 Channel Sender Interface

Create `services/api/src/messaging/interfaces/channel-sender.interface.ts`:

```typescript
export interface SendResult {
  success: boolean;
  providerRef?: string;
  error?: string;
}

export interface ChannelSender {
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';
  send(params: {
    userId: string;
    to: string; // email, phone, endpoint, or userId for IN_APP
    subject?: string;
    body: string;
    templateSlug?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SendResult>;
}
```

### 3.2 Provider Implementations

Create `services/api/src/messaging/senders/`:

| File | Channel | Provider | Notes |
|------|---------|----------|-------|
| `email.sender.ts` | EMAIL | Existing Nodemailer SMTP | Wraps `NotificationsService` email path; adds `MessageLog` row |
| `sms.sender.ts` | SMS | Twilio SMS | Uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_NUMBER`; falls back to log-only if unconfigured |
| `whatsapp.sender.ts` | WHATSAPP | Existing `WhatsAppService` | Wraps `sendMessage` / `sendFromTemplate`; adds `MessageLog` row |
| `push.sender.ts` | PUSH | Web Push (VAPID) | Uses `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`; queries `PushSubscription` for user; falls back to no-op |
| `inapp.sender.ts` | IN_APP | Prisma `Notification` | Creates `Notification` row directly (existing pattern); adds `MessageLog` row |

### 3.3 MessagingService

Create `services/api/src/messaging/messaging.service.ts`:

```typescript
@Injectable()
export class MessagingService {
  private senders: Map<string, ChannelSender>;

  /**
   * send() — consent-aware, template-rendered dispatch.
   * 1. Check user consent (gdprConsent + dataProcessingConsent.marketing + loyalty opt-ins).
   * 2. Resolve channel from user preference or journey step override.
   * 3. Render template via TemplatesService.
   * 4. Dispatch via appropriate ChannelSender.
   * 5. Write MessageLog row.
   */
  async send(params: {
    userId: string;
    channel?: string; // override; if omitted, use user.preferredCommunicationMethod
    templateSlug: string;
    templateVars: Record<string, string>;
    subject?: string;
    journeyId?: string;
    enrollmentId?: string;
  }): Promise<SendResult>;

  /**
   * sendMultiChannel() — fan-out to multiple channels for a single event.
   */
  async sendMultiChannel(params: {
    userId: string;
    channels: string[];
    templateSlug: string;
    templateVars: Record<string, string>;
    subject?: string;
    journeyId?: string;
    enrollmentId?: string;
  }): Promise<SendResult[]>;
}
```

### 3.4 MessagingModule

Create `services/api/src/messaging/messaging.module.ts`:

```typescript
@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, TemplatesModule,
            NotificationsModule, WhatsAppModule],
  providers: [
    MessagingService,
    EmailSender, SmsSender, WhatsAppSender, PushSender, InAppSender,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
```

---

## 4. JOURNEY ENGINE

### 4.1 Journey Step Schema (stored in `MarketingJourney.steps` JSON)

```typescript
type JourneyStep = {
  stepIndex: number;
  type: 'SEND' | 'WAIT' | 'CONDITION' | 'SPLIT';

  // SEND step
  channel?: string;       // EMAIL, SMS, WHATSAPP, PUSH, IN_APP, or USER_PREFERRED
  templateSlug?: string;
  subject?: string;
  templateVars?: Record<string, string>; // static overrides; dynamic vars filled at runtime

  // WAIT step
  delayMinutes?: number;  // e.g. 1440 = 24 hours

  // CONDITION step — if false, skip to step at `skipToStep`
  condition?: {
    field: string;        // e.g. 'user.loyaltyMembership.currentBalance'
    operator: 'gt' | 'lt' | 'eq' | 'exists' | 'not_exists';
    value: unknown;
  };
  skipToStep?: number;    // step index to jump to if condition is false
};
```

### 4.2 JourneyService

Create `services/api/src/journeys/journey.service.ts`:

**Core methods:**

| Method | Purpose |
|--------|---------|
| `enrollUser(journeySlug, userId, metadata?)` | Create `JourneyEnrollment`, compute `nextStepAt` for first step |
| `processStep(enrollmentId)` | Execute current step (send / wait / condition), advance `currentStep`, set `nextStepAt` for next WAIT |
| `processDueEnrollments()` | Called by cron; find `ACTIVE` enrollments where `nextStepAt <= now`, process each |
| `cancelEnrollment(enrollmentId)` | Set status `CANCELLED` |
| `getJourneyStats(journeyId)` | Aggregate enrollment statuses, message counts |

**Step execution logic:**

```
for each step starting at currentStep:
  SEND  → MessagingService.send(), advance
  WAIT  → set nextStepAt = now + delayMinutes, return (cron picks up later)
  CONDITION → evaluate; if true advance, if false skipToStep
  SPLIT → not implemented (future A/B testing)
if no more steps → mark enrollment COMPLETED
```

### 4.3 JourneyModule

Create `services/api/src/journeys/journey.module.ts`:

```typescript
@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, MessagingModule],
  controllers: [JourneyController, JourneyAdminController],
  providers: [JourneyService, JourneyJobsService],
  exports: [JourneyService],
})
export class JourneyModule {}
```

---

## 5. JOURNEY DEFINITIONS (Built-in Flows)

Seed these as `MarketingJourney` rows. Each journey fires on a specific `triggerEvent`.

### 5.1 Welcome Series

| Property | Value |
|----------|-------|
| slug | `welcome-series` |
| triggerEvent | `LOYALTY_WELCOME` |
| steps | 1. **SEND** email `welcome_loyalty` (immediate) — "Welcome to The Enchanted Circle" <br> 2. **WAIT** 24h <br> 3. **SEND** email `welcome_explore` — "Discover your first quest" <br> 4. **WAIT** 72h <br> 5. **CONDITION** `user.loyaltyMembership.purchaseCount` `eq` 0 <br> 6. **SEND** email `welcome_first_purchase` — "Your first enchanted purchase awaits" (10% coupon) <br> 7. **WAIT** 48h <br> 8. **SEND** whatsapp `whatsapp_welcome_quiz` — "Take your first fandom quiz" |

### 5.2 Post-Purchase Thank You

| Property | Value |
|----------|-------|
| slug | `post-purchase` |
| triggerEvent | `ORDER_PAID` |
| steps | 1. **WAIT** 2h <br> 2. **SEND** USER_PREFERRED `post_purchase_thankyou` — "Thanks for your order! You earned {points} points" <br> 3. **WAIT** 7 days <br> 4. **SEND** email `post_purchase_review` — "How was your {productName}? Leave a review for 25 points" |

### 5.3 Tier Upgrade Celebration

| Property | Value |
|----------|-------|
| slug | `tier-upgrade` |
| triggerEvent | `LOYALTY_TIER_UPGRADE` |
| steps | 1. **SEND** email `tier_upgrade_congrats` — "You've reached {newTier}! Here's what's new" <br> 2. **SEND** push `tier_upgrade_push` — "Congratulations! You're now a {newTier}" <br> 3. **WAIT** 48h <br> 4. **SEND** USER_PREFERRED `tier_upgrade_benefits` — "Don't forget your {newTier} benefits" |

### 5.4 Birthday Flow

| Property | Value |
|----------|-------|
| slug | `birthday-celebration` |
| triggerEvent | `LOYALTY_BIRTHDAY` |
| steps | 1. **SEND** email `birthday_greeting` — "Happy Birthday, {firstName}! {bonusPoints} bonus points are waiting" <br> 2. **SEND** whatsapp `whatsapp_birthday` — "🎂 Happy Birthday from House of Spells!" <br> 3. **WAIT** 7 days <br> 4. **CONDITION** `metadata.birthdayRedeemed` `eq` false <br> 5. **SEND** email `birthday_reminder` — "Your birthday bonus expires soon!" |

### 5.5 Abandoned Cart Recovery

| Property | Value |
|----------|-------|
| slug | `abandoned-cart` |
| triggerEvent | `CART_ABANDONED` |
| steps | 1. **WAIT** 1h <br> 2. **SEND** email `abandoned_cart_reminder` — "You left something enchanted behind" <br> 3. **WAIT** 24h <br> 4. **CONDITION** `metadata.cartRecovered` `eq` false <br> 5. **SEND** USER_PREFERRED `abandoned_cart_incentive` — "Complete your order and earn double points" <br> 6. **WAIT** 48h <br> 7. **CONDITION** `metadata.cartRecovered` `eq` false <br> 8. **SEND** email `abandoned_cart_final` — "Last chance — items may sell out" |

### 5.6 Win-Back (Inactive Member)

| Property | Value |
|----------|-------|
| slug | `win-back` |
| triggerEvent | `MEMBER_INACTIVE` |
| steps | 1. **SEND** email `winback_miss_you` — "We miss you, {firstName}! Here's what's new" <br> 2. **WAIT** 7 days <br> 3. **CONDITION** `metadata.reactivated` `eq` false <br> 4. **SEND** USER_PREFERRED `winback_incentive` — "Come back for 2x points this weekend" <br> 5. **WAIT** 14 days <br> 6. **CONDITION** `metadata.reactivated` `eq` false <br> 7. **SEND** email `winback_final` — "Your points are waiting — don't let them expire" |

### 5.7 Points Expiry Warning

| Property | Value |
|----------|-------|
| slug | `points-expiry-warning` |
| triggerEvent | `POINTS_EXPIRY_WARNING` |
| steps | 1. **SEND** email `points_expiry_30d` — "{expiringPoints} points expire in 30 days" <br> 2. **WAIT** 14 days <br> 3. **CONDITION** `metadata.pointsStillExpiring` `eq` true <br> 4. **SEND** USER_PREFERRED `points_expiry_14d` — "Only 14 days left to use {expiringPoints} points" <br> 5. **WAIT** 10 days <br> 6. **SEND** email `points_expiry_final` — "Last 4 days! Use your points now" |

---

## 6. EVENT BUS & TRIGGER SYSTEM

### 6.1 MarketingEventBus

Create `services/api/src/journeys/marketing-event.bus.ts`:

```typescript
@Injectable()
export class MarketingEventBus {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private queue: QueueService,
  ) {}

  /**
   * emit() — Find all active journeys matching triggerEvent,
   * evaluate triggerConditions, enroll user if not already enrolled.
   * Queues enrollment processing via BullMQ for async execution.
   */
  async emit(event: string, userId: string, data?: Record<string, unknown>): Promise<void>;
}
```

### 6.2 Wiring Events into Existing Services

| Existing service / hook | Event to emit | Data payload |
|-------------------------|---------------|-------------|
| `LoyaltyService.enroll` → after `onWelcome` | `LOYALTY_WELCOME` | `{ tierName, firstName }` |
| `LoyaltyEventService.onTierChange` (upgrade only) | `LOYALTY_TIER_UPGRADE` | `{ oldTier, newTier, membershipId }` |
| `PaymentsService.handlePaymentSuccess` | `ORDER_PAID` | `{ orderId, orderNumber, totalAmount, loyaltyPointsEarned }` |
| `LoyaltyJobsService` birthday bonus (after award) | `LOYALTY_BIRTHDAY` | `{ firstName, bonusPoints, membershipId }` |
| `LoyaltyJobsService` points expiry (before expire) | `POINTS_EXPIRY_WARNING` | `{ expiringPoints, expiryDate, membershipId }` |
| New `AbandonedCartJob` (see §8) | `CART_ABANDONED` | `{ cartId, userId, itemCount, cartTotal }` |
| New `InactivityJob` (see §9) | `MEMBER_INACTIVE` | `{ userId, lastPurchaseDate, daysSinceLastPurchase }` |
| `AuthService.login` (update `lastLoginAt`) | — (no journey, just tracking) | Update `User.lastLoginAt` |

### 6.3 Integration Points

Emit calls should be **fire-and-forget** (`.catch(() => {})`) from existing services so marketing automation never blocks core business logic.

---

## 7. CONSENT-AWARE SEND PIPELINE

### 7.1 Consent Resolution

Before sending any marketing message, `MessagingService.send()` must check:

```
1. user.gdprConsent === true
2. user.dataProcessingConsent.marketing === true (if present)
3. Channel-specific:
   - EMAIL:    loyaltyMembership.optInEmail !== false
   - SMS:      loyaltyMembership.optInSms !== false
   - WHATSAPP: loyaltyMembership.optInWhatsapp !== false
   - PUSH:     loyaltyMembership.optInPush !== false
   - IN_APP:   always allowed (transactional)
4. NewsletterSubscription.status !== 'unsubscribed' (for newsletter-sourced flows)
```

If any check fails, **skip silently** — log to `MessageLog` with `status: 'SKIPPED_CONSENT'` and do not send.

### 7.2 Unsubscribe Handling

Add `GET /messaging/unsubscribe?token={jwt}` — public endpoint. JWT contains `{ userId, channel, journeyId? }`. On visit:
- Set `loyaltyMembership.optIn{Channel}` to `false`
- Cancel all active journey enrollments for that channel
- Log `GDPRConsentLog` entry
- Show confirmation page

### 7.3 Preference Center

`GET /loyalty/preferences` (authenticated) — returns opt-in state for each channel.
`PATCH /loyalty/preferences` (authenticated) — update opt-in state, log consent changes.

---

## 8. ABANDONED CART RECOVERY

### 8.1 AbandonedCartJob

Create `services/api/src/journeys/jobs/abandoned-cart.job.ts`:

**Cron:** `ABANDONED_CART_CRON` (default: `*/15 * * * *` — every 15 minutes).

**Logic:**
```
1. Find carts where:
   - userId IS NOT NULL
   - items count > 0
   - updatedAt < now() - ABANDONED_CART_THRESHOLD_MINUTES (default 60)
   - abandonedEmailSentAt IS NULL or < now() - 24h (re-trigger after 24h)
   - cart NOT converted to order (no order with same userId created after cart.updatedAt)
2. For each cart:
   - Emit CART_ABANDONED event via MarketingEventBus
   - Update cart.abandonedEmailSentAt = now()
```

### 8.2 Cart Recovery Tracking

When a user with an active `abandoned-cart` journey enrollment completes a purchase:
- In `PaymentsService.handlePaymentSuccess`, update enrollment metadata `{ cartRecovered: true }`
- Journey CONDITION steps will then skip remaining reminders

---

## 9. BULLMQ JOBS & SCHEDULING

### 9.1 New Job Types

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
JOURNEY_STEP_PROCESS = 'marketing:journey-step-process',
JOURNEY_ENROLLMENT = 'marketing:journey-enrollment',
ABANDONED_CART_SCAN = 'marketing:abandoned-cart-scan',
INACTIVITY_SCAN = 'marketing:inactivity-scan',
MESSAGE_SEND = 'marketing:message-send',
```

### 9.2 New Repeatable Crons

| Job | Default Cron | Env Override |
|-----|-------------|--------------|
| `JOURNEY_STEP_PROCESS` | `* * * * *` (every minute) | `JOURNEY_STEP_CRON` |
| `ABANDONED_CART_SCAN` | `*/15 * * * *` (every 15 min) | `ABANDONED_CART_CRON` |
| `INACTIVITY_SCAN` | `0 8 * * 1` (Monday 8 AM) | `INACTIVITY_SCAN_CRON` |

### 9.3 Journey Step Processor

The `JOURNEY_STEP_PROCESS` cron calls `JourneyService.processDueEnrollments()`:

```
1. SELECT enrollments WHERE status = 'ACTIVE' AND nextStepAt <= NOW() LIMIT 100
2. For each enrollment: processStep(enrollment.id)
3. If step is SEND: queue MESSAGE_SEND job (async)
4. If step is WAIT: set nextStepAt, return
5. If step is CONDITION: evaluate, advance or skip
6. If no more steps: mark COMPLETED
```

### 9.4 Inactivity Scanner

`INACTIVITY_SCAN` job:
```
1. Find LoyaltyMemberships where:
   - User.lastLoginAt < now() - 60 days (or no lastLoginAt and updatedAt < 60 days)
   - No order in last 60 days
   - Not already in 'win-back' journey enrollment
2. Emit MEMBER_INACTIVE for each qualifying user
```

---

## 10. REST API ENDPOINTS

### 10.1 Messaging Preferences (Customer)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/loyalty/preferences` | Get channel opt-in/out preferences |
| `PATCH` | `/loyalty/preferences` | Update opt-in/out for EMAIL, SMS, WHATSAPP, PUSH |

### 10.2 Push Subscriptions (Customer)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/messaging/push/subscribe` | Register push subscription (endpoint + keys) |
| `DELETE` | `/messaging/push/unsubscribe` | Remove push subscription |

### 10.3 Unsubscribe (Public)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/messaging/unsubscribe` | Token-based one-click unsubscribe |

### 10.4 Message History (Customer)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/messaging/history` | Paginated message log for authenticated user |

---

## 11. ADMIN API ENDPOINTS

### 11.1 Journey Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/journeys` | List all journeys with enrollment counts |
| `GET` | `/admin/journeys/:id` | Journey detail with steps + stats |
| `POST` | `/admin/journeys` | Create journey |
| `PATCH` | `/admin/journeys/:id` | Update journey (name, steps, conditions, active) |
| `DELETE` | `/admin/journeys/:id` | Deactivate journey (soft) |
| `GET` | `/admin/journeys/:id/enrollments` | List enrollments with status breakdown |
| `POST` | `/admin/journeys/:id/trigger` | Manually trigger journey for a user or segment |

### 11.2 Messaging Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/messaging/logs` | Paginated message logs with filters (channel, status, date) |
| `GET` | `/admin/messaging/stats` | Aggregate: sent/delivered/failed/opened by channel, last 30 days |
| `POST` | `/admin/messaging/broadcast` | Send ad-hoc message to segment (tier, region, fandom) |

---

## 12. FRONTEND PAGES

### 12.1 Customer Pages

| Page | Path | Description |
|------|------|-------------|
| Messaging preferences | `/loyalty` (extend existing) | Toggle email/SMS/WhatsApp/push opt-in/out within the loyalty dashboard |
| Unsubscribe confirmation | `/unsubscribe` | Public page shown after clicking unsubscribe link |
| Message history | `/loyalty/messages` | Timeline of messages received (optional, links from loyalty dash) |

### 12.2 Admin Pages

| Page | Path | Description |
|------|------|-------------|
| Journey list | `/admin/journeys` | Table of journeys: name, trigger, active enrollments, status toggle |
| Journey detail | `/admin/journeys/[id]` | Visual step list, enrollment stats, manual trigger |
| Journey editor | `/admin/journeys/new` / `/admin/journeys/[id]/edit` | Form to create/edit journey steps |
| Message logs | `/admin/messaging` | Searchable table of recent messages with channel/status filters |
| Messaging stats | `/admin/messaging/stats` | Dashboard cards: sent today, delivery rate, channel breakdown chart |

### 12.3 AdminLayout Addition

Add to the sidebar under "Marketing":
- "Journeys" → `/admin/journeys`
- "Message Logs" → `/admin/messaging`

---

## 13. API CLIENT EXTENSIONS

Add to `packages/api-client/src/client.ts`:

```typescript
// Messaging preferences
async getLoyaltyPreferences(): Promise<ApiResponse<unknown>>;
async updateLoyaltyPreferences(body: {
  optInEmail?: boolean; optInSms?: boolean;
  optInWhatsapp?: boolean; optInPush?: boolean;
}): Promise<ApiResponse<unknown>>;

// Push subscriptions
async subscribePush(body: { endpoint: string; keys: object; platform?: string }): Promise<ApiResponse<unknown>>;
async unsubscribePush(): Promise<ApiResponse<unknown>>;

// Message history
async getMessageHistory(params?: { page?: number; limit?: number }): Promise<ApiResponse<unknown>>;

// Admin — Journeys
async adminListJourneys(): Promise<ApiResponse<unknown>>;
async adminGetJourney(id: string): Promise<ApiResponse<unknown>>;
async adminCreateJourney(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminUpdateJourney(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;
async adminDeleteJourney(id: string): Promise<ApiResponse<unknown>>;
async adminGetJourneyEnrollments(id: string): Promise<ApiResponse<unknown>>;
async adminTriggerJourney(id: string, body: { userId?: string; segment?: Record<string, unknown> }): Promise<ApiResponse<unknown>>;

// Admin — Messaging
async adminGetMessageLogs(params?: Record<string, string>): Promise<ApiResponse<unknown>>;
async adminGetMessagingStats(): Promise<ApiResponse<unknown>>;
async adminBroadcast(body: { channels: string[]; templateSlug: string; subject?: string; segment: Record<string, unknown>; templateVars?: Record<string, string> }): Promise<ApiResponse<unknown>>;
```

---

## 14. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```typescript
// Phase 4 — Marketing Automation
JOURNEY_STEP_CRON?: string;               // default: '* * * * *'
ABANDONED_CART_CRON?: string;              // default: '*/15 * * * *'
ABANDONED_CART_THRESHOLD_MINUTES?: number;  // default: 60
INACTIVITY_SCAN_CRON?: string;             // default: '0 8 * * 1'
INACTIVITY_DAYS_THRESHOLD?: number;         // default: 60

// Twilio SMS (in addition to existing WhatsApp Twilio vars)
TWILIO_SMS_NUMBER?: string;

// Web Push VAPID
VAPID_PUBLIC_KEY?: string;
VAPID_PRIVATE_KEY?: string;
VAPID_SUBJECT?: string;                    // default: 'mailto:hello@houseofspells.co.uk'
```

---

## 15. TESTING STRATEGY

### 15.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `journeys/journey.service.spec.ts` | 8 | enrollUser, processStep (SEND/WAIT/CONDITION), processDueEnrollments, cancelEnrollment, no duplicate enrollment |
| `journeys/marketing-event.bus.spec.ts` | 4 | emit matches journey, condition filter, skip inactive journey, fire-and-forget |
| `journeys/jobs/abandoned-cart.job.spec.ts` | 4 | detects abandoned carts, skips recovered, respects threshold, updates sentAt |
| `messaging/messaging.service.spec.ts` | 6 | consent check (pass/fail), channel resolution, template rendering, MessageLog creation, multi-channel fan-out |
| `messaging/senders/email.sender.spec.ts` | 3 | send success, SMTP disabled fallback, error handling |
| `messaging/senders/sms.sender.spec.ts` | 3 | send success, Twilio unconfigured fallback, error |
| `messaging/senders/push.sender.spec.ts` | 3 | send to subscription, no subscription skip, error |

**Total: ≥ 31 new tests**

### 15.2 Test Commands

```bash
npx jest --testPathPattern="(journey|messaging|abandoned-cart)" --no-cache --forceExit
```

---

## 16. MIGRATION & SEED SCRIPT

### 16.1 Migration

File: `services/api/prisma/migrations/20260505100000_phase4_marketing_automation/migration.sql` (see §2.4)

### 16.2 Journey Seed

Create `services/api/prisma/seeds/journey-seed.ts`:

Seed all 7 built-in journeys from §5 with their step definitions. Each journey should be created with `isActive: true`.

Add to `services/api/package.json`:

```json
"db:seed-journeys": "ts-node prisma/seeds/journey-seed.ts"
```

### 16.3 Template Seed

Create `services/api/prisma/seeds/marketing-template-seed.ts`:

Seed all new email/WhatsApp/SMS templates referenced by journey steps:

| Template Slug | Channel | Subject |
|---------------|---------|---------|
| `welcome_loyalty` | EMAIL | Welcome to The Enchanted Circle |
| `welcome_explore` | EMAIL | Discover Your First Quest |
| `welcome_first_purchase` | EMAIL | Your First Enchanted Purchase Awaits |
| `whatsapp_welcome_quiz` | WHATSAPP | Take Your First Fandom Quiz |
| `post_purchase_thankyou` | EMAIL | Thanks for Your Order! |
| `post_purchase_review` | EMAIL | How Was Your Purchase? |
| `tier_upgrade_congrats` | EMAIL | Congratulations on Your New Tier! |
| `tier_upgrade_push` | PUSH | Tier Upgrade! |
| `tier_upgrade_benefits` | EMAIL | Your New Tier Benefits |
| `birthday_greeting` | EMAIL | Happy Birthday! |
| `whatsapp_birthday` | WHATSAPP | Happy Birthday from House of Spells |
| `birthday_reminder` | EMAIL | Your Birthday Bonus Expires Soon |
| `abandoned_cart_reminder` | EMAIL | You Left Something Enchanted Behind |
| `abandoned_cart_incentive` | EMAIL | Complete Your Order for Double Points |
| `abandoned_cart_final` | EMAIL | Last Chance — Items May Sell Out |
| `winback_miss_you` | EMAIL | We Miss You! |
| `winback_incentive` | EMAIL | Come Back for 2x Points |
| `winback_final` | EMAIL | Your Points Are Waiting |
| `points_expiry_30d` | EMAIL | Points Expiring Soon |
| `points_expiry_14d` | EMAIL | 14 Days Left to Use Your Points |
| `points_expiry_final` | EMAIL | Last 4 Days — Use Your Points Now |

Add to `services/api/package.json`:

```json
"db:seed-templates": "ts-node prisma/seeds/marketing-template-seed.ts"
```

---

## 17. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Welcome series triggers on loyalty enrollment | Enroll user, verify 3 journey steps execute over time |
| 2 | Post-purchase journey sends thank-you + review request | Complete order, verify 2 messages after delays |
| 3 | Tier upgrade triggers congratulation email + push | Earn enough points to tier up, verify messages |
| 4 | Birthday flow awards bonus + sends greeting | Set birthday to today, run cron, verify email + WhatsApp |
| 5 | Abandoned cart detected and recovery emails sent | Add items to cart, wait 1h+, verify 3-step recovery |
| 6 | Cart recovery cancels remaining abandoned cart steps | Complete purchase after first reminder, verify no further emails |
| 7 | Win-back journey targets 60-day inactive members | Create user with no recent login/orders, run scan, verify emails |
| 8 | Points expiry warning sends 30d/14d/4d reminders | Set points to expire, verify 3-step flow |
| 9 | Consent checks prevent sending to opted-out users | Opt out of email, trigger journey, verify email skipped with SKIPPED_CONSENT log |
| 10 | Unsubscribe link works for one-click opt-out | Click unsubscribe URL, verify preference updated + consent logged |
| 11 | MessagingService respects user's preferred channel | Set preference to WHATSAPP, trigger USER_PREFERRED step, verify WhatsApp sent |
| 12 | MessageLog records every send attempt with status | Send messages, verify rows in message_logs table |
| 13 | Push notifications delivered to web subscribers | Register push subscription, trigger push step, verify delivery |
| 14 | SMS fallback when Twilio unconfigured | Remove SMS config, trigger SMS step, verify graceful skip + log |
| 15 | Admin can create/edit/deactivate journeys | Use admin API, verify CRUD operations |
| 16 | Admin can view message logs + stats | Call admin endpoints, verify aggregated data |
| 17 | Admin can manually trigger journey for user/segment | POST trigger, verify enrollment created and steps start |
| 18 | Journey CONDITION steps correctly branch execution | Test condition-true and condition-false paths |
| 19 | Duplicate enrollment prevented (same journey + user) | Trigger same event twice, verify single enrollment |
| 20 | ≥ 31 unit tests passing | `npx jest --testPathPattern="(journey\|messaging\|abandoned-cart)"` |
| 21 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 22 | Prisma schema validates | `npx prisma validate` |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (4 new models, User additions)
│   ├── migrations/
│   │   └── 20260505100000_phase4_marketing_automation/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       ├── journey-seed.ts                              # NEW
│       └── marketing-template-seed.ts                   # NEW
├── src/
│   ├── messaging/
│   │   ├── messaging.module.ts                          # NEW
│   │   ├── messaging.service.ts                         # NEW
│   │   ├── messaging.service.spec.ts                    # NEW
│   │   ├── interfaces/
│   │   │   └── channel-sender.interface.ts              # NEW
│   │   └── senders/
│   │       ├── email.sender.ts                          # NEW
│   │       ├── email.sender.spec.ts                     # NEW
│   │       ├── sms.sender.ts                            # NEW
│   │       ├── sms.sender.spec.ts                       # NEW
│   │       ├── whatsapp.sender.ts                       # NEW
│   │       ├── push.sender.ts                           # NEW
│   │       ├── push.sender.spec.ts                      # NEW
│   │       └── inapp.sender.ts                          # NEW
│   ├── journeys/
│   │   ├── journey.module.ts                            # NEW
│   │   ├── journey.service.ts                           # NEW
│   │   ├── journey.service.spec.ts                      # NEW
│   │   ├── journey.controller.ts                        # NEW (customer: preferences, push, history)
│   │   ├── journey-admin.controller.ts                  # NEW
│   │   ├── marketing-event.bus.ts                       # NEW
│   │   ├── marketing-event.bus.spec.ts                  # NEW
│   │   ├── dto/
│   │   │   ├── create-journey.dto.ts                    # NEW
│   │   │   ├── update-journey.dto.ts                    # NEW
│   │   │   ├── update-preferences.dto.ts                # NEW
│   │   │   └── broadcast.dto.ts                         # NEW
│   │   └── jobs/
│   │       ├── journey.jobs.ts                          # NEW (step processor cron)
│   │       ├── abandoned-cart.job.ts                     # NEW
│   │       ├── abandoned-cart.job.spec.ts                # NEW
│   │       └── inactivity.job.ts                        # NEW
│   ├── loyalty/
│   │   ├── loyalty.service.ts                           # MODIFIED (emit LOYALTY_WELCOME)
│   │   ├── loyalty.controller.ts                        # MODIFIED (preferences endpoint)
│   │   ├── services/
│   │   │   └── loyalty-event.service.ts                 # MODIFIED (emit events to MarketingEventBus)
│   │   └── jobs/
│   │       └── loyalty.jobs.ts                          # MODIFIED (emit LOYALTY_BIRTHDAY, POINTS_EXPIRY_WARNING)
│   ├── payments/
│   │   └── payments.service.ts                          # MODIFIED (emit ORDER_PAID + cart recovery tracking)
│   ├── auth/
│   │   └── auth.service.ts                              # MODIFIED (update lastLoginAt on login)
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (5 new job types)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (Phase 4 env vars)
│   └── app.module.ts                                    # MODIFIED (add MessagingModule, JourneyModule)
├── package.json                                         # MODIFIED (seed scripts)

apps/web/src/
├── app/
│   ├── loyalty/
│   │   ├── page.tsx                                     # MODIFIED — add preferences toggles
│   │   └── messages/
│   │       └── page.tsx                                 # NEW — message history
│   ├── unsubscribe/
│   │   └── page.tsx                                     # NEW — unsubscribe confirmation
│   └── admin/
│       ├── journeys/
│       │   ├── page.tsx                                 # NEW — journey list
│       │   ├── [id]/
│       │   │   └── page.tsx                             # NEW — journey detail + edit
│       │   └── new/
│       │       └── page.tsx                             # NEW — create journey
│       └── messaging/
│           ├── page.tsx                                 # NEW — message logs
│           └── stats/
│               └── page.tsx                             # NEW — messaging dashboard
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — add Journeys + Messaging links

packages/api-client/src/
└── client.ts                                            # MODIFIED (preferences, push, journeys, messaging admin)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add 4 new models, User.lastLoginAt, run migration, regenerate Prisma
2. **Messaging provider abstraction** — ChannelSender interface, 5 senders, MessagingService with consent pipeline
3. **Journey engine** — JourneyService (enroll, processStep, processDue), MarketingEventBus
4. **Wire events** — Emit from loyalty (welcome, tier, birthday, expiry), payments (order paid), auth (lastLoginAt)
5. **Abandoned cart job** — Cart scanner cron + CART_ABANDONED event + recovery tracking
6. **Inactivity scanner** — MEMBER_INACTIVE event + win-back enrollment
7. **BullMQ jobs** — Register all new job types + crons
8. **REST endpoints** — Preferences, push subscribe, unsubscribe, message history
9. **Admin endpoints** — Journey CRUD, messaging logs/stats, broadcast, manual trigger
10. **API Client** — Add all new methods
11. **Frontend pages** — Preferences in loyalty dash, admin journey pages, message logs, unsubscribe page
12. **Seed scripts** — Journey definitions + marketing templates
13. **Unit tests** — ≥ 31 tests across 7 spec files
14. **Build verification** — `npx tsc --noEmit && npx jest && npx prisma validate`

---

**End of Phase 4 Build Spec**
