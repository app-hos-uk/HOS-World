# Phase 5 — Event & Experience Management: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-5-events`  
**Base:** `feature/loyalty-phase-4-marketing` (all Phase 1–4 work merged)  
**Estimated:** 3–4 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Events Module — Core Service](#3-events-module--core-service)
4. [RSVP & Ticketing](#4-rsvp--ticketing)
5. [Attendance Tracking & Point Awards](#5-attendance-tracking--point-awards)
6. [Tier-Based Access Control](#6-tier-based-access-control)
7. [Event Reminders & Notification Jobs](#7-event-reminders--notification-jobs)
8. [Marketing Journey Integration](#8-marketing-journey-integration)
9. [REST API Endpoints (Customer)](#9-rest-api-endpoints-customer)
10. [Admin API Endpoints](#10-admin-api-endpoints)
11. [Frontend Pages (Customer)](#11-frontend-pages-customer)
12. [Frontend Pages (Admin)](#12-frontend-pages-admin)
13. [API Client Extensions](#13-api-client-extensions)
14. [Environment Variables](#14-environment-variables)
15. [Testing Strategy](#15-testing-strategy)
16. [Migration & Seed Script](#16-migration--seed-script)
17. [Acceptance Criteria](#17-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 5, confirm:

- [ ] Phase 1–4 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 120+ loyalty, POS, quiz, journey, and messaging tests pass (`npx jest --testPathPattern="(loyalty|pos|quiz|journey|messaging|abandoned-cart)"`)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1–4 services are functional:
  - `LoyaltyService` (enrollment, check-in, earn, redeem, preferences)
  - `LoyaltyEarnEngine` (processOrderComplete, processPosSale)
  - `LoyaltyWalletService` (applyDelta for EARN/BURN/BONUS transactions)
  - `LoyaltyTierEngine` (recalculateTier with composite scoring)
  - `LoyaltyEventService` (onTierChange with marketing bus emit)
  - `LoyaltyListener` (Phase 3 hooks: review, social, quest, quiz, referral)
  - `MessagingService` (consent-aware multi-channel send with unsubscribe tokens)
  - `MarketingEventBus` (fire-and-forget event emission + journey enrollment)
  - `JourneyService` (enrollment, processStep with SEND/WAIT/CONDITION/SPLIT)
  - `NotificationsService` (SMTP email via BullMQ, template rendering)
  - `QueueService` / BullMQ (job queue, repeatable cron, processors)
  - `GamificationService` (awardPoints bridge to loyalty wallet)
- [ ] Existing models to leverage:
  - `User` (id, firstName, lastName, email, phone, birthday, loyaltyMembership, gdprConsent)
  - `Store` (id, code, name, address, city, country, timezone, latitude, longitude, isActive)
  - `Fandom` (id, name, slug, isActive)
  - `LoyaltyMembership` (userId, tierId, tier, currentBalance, totalPointsEarned, engagementCount, purchaseCount)
  - `LoyaltyTier` (id, slug, name, minPoints, multiplier, level)
  - `LoyaltyEarnRule` (action: unique string, pointsAmount, maxPerDay, maxPerUser, conditions, regionCodes)
  - `LoyaltyTransaction` (membershipId, type, source, sourceId, points, description)
  - `Notification` (userId, type: NotificationType, status, metadata)
  - `NotificationType` enum — already has `EVENT_INVITATION` and `EVENT_REMINDER`
- [ ] Existing `JobType` values in `queue.bullmq.impl.ts` to reference (do NOT modify existing ones):
  - `EMAIL_NOTIFICATION`, `LOYALTY_TIER_REVIEW`, `LOYALTY_POINTS_EXPIRY`, `LOYALTY_BIRTHDAY_BONUS`
  - `FANDOM_PROFILE_RECOMPUTE`, `POS_*` (6 types), `JOURNEY_STEP_PROCESS`, `ABANDONED_CART_SCAN`
  - `INACTIVITY_SCAN`, `MESSAGE_SEND`, `MARKETING_POINTS_EXPIRY_WARNING`

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**Event — a scheduled in-store or virtual experience:**

```prisma
model Event {
  id              String     @id @default(uuid())
  title           String
  slug            String     @unique
  description     String?    @db.Text
  shortDescription String?
  type            String     @default("IN_STORE") // IN_STORE, VIRTUAL, HYBRID, PRODUCT_LAUNCH, FAN_MEETUP, VIP_EXPERIENCE
  status          String     @default("DRAFT")    // DRAFT, PUBLISHED, SOLD_OUT, CANCELLED, COMPLETED
  imageUrl        String?
  bannerUrl       String?

  // Location (physical events)
  storeId         String?
  store           Store?     @relation(fields: [storeId], references: [id], onDelete: SetNull)
  venueName       String?
  venueAddress    String?

  // Virtual events
  virtualUrl      String?    // Zoom/Teams/YouTube link (revealed after RSVP)
  virtualPlatform String?    // ZOOM, TEAMS, YOUTUBE_LIVE, CUSTOM

  // Scheduling
  startsAt        DateTime
  endsAt          DateTime
  timezone        String     @default("Europe/London")
  doorsOpenAt     DateTime?  // For physical events, doors open before start

  // Capacity & access
  capacity        Int?       // null = unlimited
  isPublic        Boolean    @default(true)
  minTierLevel    Int        @default(0)  // 0 = any tier, 4 = Dragon Keeper+, etc.
  allowedTierIds  String[]   @default([]) // Specific tier IDs allowed (empty = all above minTierLevel)
  requiresTicket  Boolean    @default(false)
  ticketPrice     Decimal?   @db.Decimal(10, 2) // 0 or null = free
  ticketCurrency  String     @default("GBP")

  // Loyalty integration
  attendancePoints Int       @default(100) // Points awarded on attendance check-in
  earnRuleAction  String?    // Maps to LoyaltyEarnRule.action for custom earn logic

  // Fandom association
  fandomId        String?
  fandom          Fandom?    @relation(fields: [fandomId], references: [id], onDelete: SetNull)
  tags            String[]   @default([])

  // Metadata
  hostName        String?    // "Store Manager", "Guest Author", etc.
  hostBio         String?    @db.Text
  agenda          Json?      // Array of { time, title, description }
  metadata        Json?

  createdBy       String?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  rsvps           EventRSVP[]
  attendances     EventAttendance[]

  @@index([storeId])
  @@index([fandomId])
  @@index([status])
  @@index([startsAt])
  @@index([type])
  @@index([minTierLevel])
  @@map("events")
}
```

**EventRSVP — a customer's reservation for an event:**

```prisma
model EventRSVP {
  id            String    @id @default(uuid())
  eventId       String
  event         Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  status        String    @default("CONFIRMED") // CONFIRMED, WAITLISTED, CANCELLED, NO_SHOW
  guestCount    Int       @default(0)           // Additional guests (0 = just the member)
  ticketCode    String?   @unique               // 8-char alphanumeric for scanning
  notes         String?
  rsvpAt        DateTime  @default(now())
  cancelledAt   DateTime?
  metadata      Json?

  @@unique([eventId, userId])
  @@index([userId])
  @@index([status])
  @@index([ticketCode])
  @@map("event_rsvps")
}
```

**EventAttendance — check-in record (proves physical/virtual presence):**

```prisma
model EventAttendance {
  id            String    @id @default(uuid())
  eventId       String
  event         Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  checkedInAt   DateTime  @default(now())
  checkedInBy   String?   // Staff user ID who scanned (null = self check-in)
  method        String    @default("QR_SCAN") // QR_SCAN, MANUAL, VIRTUAL_JOIN, TICKET_SCAN
  pointsAwarded Int       @default(0)
  transactionId String?   // LoyaltyTransaction.id for the attendance earn
  metadata      Json?

  @@unique([eventId, userId])
  @@index([userId])
  @@index([eventId])
  @@map("event_attendances")
}
```

### 2.2 Model Additions

**Add to `User` model:**

```prisma
model User {
  // ... existing fields ...
  eventRsvps        EventRSVP[]
  eventAttendances  EventAttendance[]
}
```

**Add to `Store` model:**

```prisma
model Store {
  // ... existing fields ...
  events  Event[]
}
```

**Add to `Fandom` model:**

```prisma
model Fandom {
  // ... existing fields ...
  events  Event[]
}
```

### 2.3 Enum Update

The `NotificationType` enum already has `EVENT_INVITATION` and `EVENT_REMINDER` — no changes needed.

### 2.4 JobType Additions

Add to `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
export enum JobType {
  // ... existing values ...
  EVENT_REMINDER = 'events:reminder',
  EVENT_ATTENDANCE_RECONCILE = 'events:attendance-reconcile',
}
```

### 2.5 Manual Migration Script

Create `services/api/prisma/migrations/20260520000000_phase5_event_management/migration.sql`:

```sql
-- Phase 5: Event & Experience Management

-- Event table
CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" TEXT,
    "type" TEXT NOT NULL DEFAULT 'IN_STORE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "imageUrl" TEXT,
    "bannerUrl" TEXT,
    "storeId" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "virtualUrl" TEXT,
    "virtualPlatform" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "doorsOpenAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "minTierLevel" INTEGER NOT NULL DEFAULT 0,
    "allowedTierIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresTicket" BOOLEAN NOT NULL DEFAULT false,
    "ticketPrice" DECIMAL(10,2),
    "ticketCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "attendancePoints" INTEGER NOT NULL DEFAULT 100,
    "earnRuleAction" TEXT,
    "fandomId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hostName" TEXT,
    "hostBio" TEXT,
    "agenda" JSONB,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "events_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "events_fandomId_fkey" FOREIGN KEY ("fandomId") REFERENCES "fandoms"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_key" ON "events"("slug");
CREATE INDEX IF NOT EXISTS "events_storeId_idx" ON "events"("storeId");
CREATE INDEX IF NOT EXISTS "events_fandomId_idx" ON "events"("fandomId");
CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events"("status");
CREATE INDEX IF NOT EXISTS "events_startsAt_idx" ON "events"("startsAt");
CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events"("type");
CREATE INDEX IF NOT EXISTS "events_minTierLevel_idx" ON "events"("minTierLevel");

-- EventRSVP table
CREATE TABLE IF NOT EXISTS "event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "ticketCode" TEXT,
    "notes" TEXT,
    "rsvpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_rsvps_eventId_userId_key" ON "event_rsvps"("eventId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "event_rsvps_ticketCode_key" ON "event_rsvps"("ticketCode");
CREATE INDEX IF NOT EXISTS "event_rsvps_userId_idx" ON "event_rsvps"("userId");
CREATE INDEX IF NOT EXISTS "event_rsvps_status_idx" ON "event_rsvps"("status");
CREATE INDEX IF NOT EXISTS "event_rsvps_ticketCode_idx" ON "event_rsvps"("ticketCode");

-- EventAttendance table
CREATE TABLE IF NOT EXISTS "event_attendances" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInBy" TEXT,
    "method" TEXT NOT NULL DEFAULT 'QR_SCAN',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "transactionId" TEXT,
    "metadata" JSONB,
    CONSTRAINT "event_attendances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_attendances_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_attendances_eventId_userId_key" ON "event_attendances"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "event_attendances_userId_idx" ON "event_attendances"("userId");
CREATE INDEX IF NOT EXISTS "event_attendances_eventId_idx" ON "event_attendances"("eventId");
```

---

## 3. EVENTS MODULE — CORE SERVICE

### 3.1 File Structure

```
services/api/src/events/
├── events.module.ts
├── events.service.ts
├── events.controller.ts            # Customer-facing
├── events-admin.controller.ts      # Admin CRUD + attendance
├── events.service.spec.ts
├── dto/
│   ├── create-event.dto.ts
│   ├── update-event.dto.ts
│   ├── rsvp-event.dto.ts
│   └── check-in.dto.ts
└── jobs/
    └── event.jobs.ts               # Reminder cron + attendance reconciliation
```

### 3.2 EventsService

**File:** `services/api/src/events/events.service.ts`

```typescript
@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private loyalty: LoyaltyWalletService,
    private tiers: LoyaltyTierEngine,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
  ) {}

  // ── Queries ──

  async findUpcoming(filters: {
    storeId?: string;
    fandomId?: string;
    type?: string;
    userId?: string; // for tier-filtered results
    page?: number;
    limit?: number;
  }): Promise<{ items: Event[]; total: number }>;

  async findById(id: string): Promise<Event & { rsvpCount: number; attendanceCount: number }>;

  async findBySlug(slug: string): Promise<Event>;

  // ── RSVP ──

  async rsvp(eventId: string, userId: string, dto: RsvpEventDto): Promise<EventRSVP>;
  // 1. Load event, check status is PUBLISHED
  // 2. Check tier access (user tier level >= event.minTierLevel, or tier in allowedTierIds)
  // 3. Check capacity: count CONFIRMED RSVPs (including guests) vs event.capacity
  // 4. If over capacity → status = 'WAITLISTED'
  // 5. Generate 8-char alphanumeric ticketCode (crypto.randomBytes)
  // 6. Create EventRSVP
  // 7. Send EVENT_INVITATION notification via NotificationsService
  // 8. Emit 'EVENT_RSVP' to MarketingEventBus (for journey triggers)
  // 9. Return RSVP with ticketCode

  async cancelRsvp(eventId: string, userId: string): Promise<void>;
  // Update status to CANCELLED, set cancelledAt
  // If waitlisted users exist, promote first waitlisted to CONFIRMED
  // Send cancellation notification

  async getMyRsvps(userId: string): Promise<EventRSVP[]>;
  // Return all non-CANCELLED RSVPs for the user with event details

  // ── Attendance ──

  async checkIn(eventId: string, userId: string, dto: CheckInDto): Promise<EventAttendance>;
  // 1. Validate RSVP exists and is CONFIRMED (or allow walk-ins if event is public)
  // 2. Prevent duplicate attendance (@@unique)
  // 3. Determine points: event.attendancePoints (or lookup LoyaltyEarnRule by event.earnRuleAction)
  // 4. Award points via LoyaltyWalletService.applyDelta(EARN, source: 'EVENT', sourceId: event.id)
  // 5. Recalculate tier via LoyaltyTierEngine.recalculateTier
  // 6. Create EventAttendance record with transactionId
  // 7. Emit 'EVENT_ATTENDED' to MarketingEventBus
  // 8. Update RSVP status to indicate attended (metadata flag)
  // Return attendance record

  async checkInByTicket(ticketCode: string, staffUserId: string): Promise<EventAttendance>;
  // Lookup RSVP by ticketCode
  // Delegate to checkIn with method: 'TICKET_SCAN', checkedInBy: staffUserId

  // ── Admin ──

  async create(dto: CreateEventDto, createdBy: string): Promise<Event>;
  // Generate slug from title (slugify + uniqueness suffix)
  // Validate startsAt < endsAt
  // Validate storeId exists if provided
  // Validate fandomId exists if provided

  async update(id: string, dto: UpdateEventDto): Promise<Event>;

  async publish(id: string): Promise<Event>;
  // Set status to PUBLISHED
  // Emit 'EVENT_PUBLISHED' to MarketingEventBus (for invitation journeys)

  async cancel(id: string, reason?: string): Promise<Event>;
  // Set status to CANCELLED
  // Cancel all CONFIRMED/WAITLISTED RSVPs
  // Send EVENT_CANCELLED notification to all RSVP'd users

  async complete(id: string): Promise<Event>;
  // Set status to COMPLETED
  // Mark any CONFIRMED RSVPs without attendance as NO_SHOW

  async getAttendees(eventId: string): Promise<EventAttendance[]>;

  async getEventStats(eventId: string): Promise<{
    rsvpConfirmed: number;
    rsvpWaitlisted: number;
    rsvpCancelled: number;
    attended: number;
    noShow: number;
    totalPointsAwarded: number;
    capacityUsed: number; // percentage
  }>;
}
```

### 3.3 Tier Access Evaluation

```typescript
private async canAccessEvent(userId: string, event: Event): Promise<{ allowed: boolean; reason?: string }> {
  if (event.minTierLevel === 0 && event.allowedTierIds.length === 0) {
    return { allowed: true };
  }
  const membership = await this.prisma.loyaltyMembership.findUnique({
    where: { userId },
    include: { tier: true },
  });
  if (!membership) return { allowed: false, reason: 'No loyalty membership' };
  if (event.allowedTierIds.length > 0) {
    return event.allowedTierIds.includes(membership.tierId)
      ? { allowed: true }
      : { allowed: false, reason: `Tier ${membership.tier.name} not eligible` };
  }
  return membership.tier.level >= event.minTierLevel
    ? { allowed: true }
    : { allowed: false, reason: `Requires tier level ${event.minTierLevel}+` };
}
```

### 3.4 Module

**File:** `services/api/src/events/events.module.ts`

```typescript
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
    LoyaltyModule,
    forwardRef(() => JourneyModule),
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'changeme'),
      }),
    }),
  ],
  controllers: [EventsController, EventsAdminController],
  providers: [EventsService, EventJobsService],
  exports: [EventsService],
})
export class EventsModule {}
```

**Wire into `app.module.ts`:**

```typescript
import { EventsModule } from './events/events.module';
// ...
@Module({
  imports: [
    // ... existing imports ...
    JourneyModule,
    EventsModule,  // NEW
  ],
})
```

---

## 4. RSVP & TICKETING

### 4.1 Ticket Code Generation

```typescript
import * as crypto from 'crypto';

function generateTicketCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex
}
```

### 4.2 RSVP Flow

1. Customer calls `POST /events/:id/rsvp`
2. Service checks tier eligibility
3. Service checks capacity (count RSVPs where `status = 'CONFIRMED'`, sum `1 + guestCount`)
4. If within capacity → `CONFIRMED`; if over → `WAITLISTED`
5. Generate unique `ticketCode`
6. Create RSVP record
7. Send `EVENT_INVITATION` notification (includes event details + ticket code)
8. Emit `EVENT_RSVP` event to `MarketingEventBus`

### 4.3 Waitlist Promotion

When a CONFIRMED RSVP is cancelled:
1. Count current confirmed capacity (including guests)
2. Find oldest WAITLISTED RSVP
3. If space available, promote to CONFIRMED
4. Send notification: "Great news! You're now confirmed for [event]"

### 4.4 DTOs

**`services/api/src/events/dto/create-event.dto.ts`:**

```typescript
export class CreateEventDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsIn(['IN_STORE', 'VIRTUAL', 'HYBRID', 'PRODUCT_LAUNCH', 'FAN_MEETUP', 'VIP_EXPERIENCE'])
  type?: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() venueName?: string;
  @IsOptional() @IsString() venueAddress?: string;
  @IsOptional() @IsString() virtualUrl?: string;
  @IsOptional() @IsString() virtualPlatform?: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsDateString() doorsOpenAt?: string;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() @Min(0) minTierLevel?: number;
  @IsOptional() @IsArray() allowedTierIds?: string[];
  @IsOptional() @IsBoolean() requiresTicket?: boolean;
  @IsOptional() @IsNumber() @Min(0) ticketPrice?: number;
  @IsOptional() @IsString() ticketCurrency?: string;
  @IsOptional() @IsInt() @Min(0) attendancePoints?: number;
  @IsOptional() @IsString() earnRuleAction?: string;
  @IsOptional() @IsString() fandomId?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() hostName?: string;
  @IsOptional() @IsString() hostBio?: string;
  @IsOptional() agenda?: unknown;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() bannerUrl?: string;
}
```

**`services/api/src/events/dto/update-event.dto.ts`:**

```typescript
export class UpdateEventDto extends PartialType(CreateEventDto) {}
```

**`services/api/src/events/dto/rsvp-event.dto.ts`:**

```typescript
export class RsvpEventDto {
  @IsOptional() @IsInt() @Min(0) @Max(5) guestCount?: number;
  @IsOptional() @IsString() notes?: string;
}
```

**`services/api/src/events/dto/check-in.dto.ts`:**

```typescript
export class CheckInDto {
  @IsOptional() @IsString() ticketCode?: string;
  @IsOptional() @IsIn(['QR_SCAN', 'MANUAL', 'VIRTUAL_JOIN', 'TICKET_SCAN'])
  method?: string;
}
```

---

## 5. ATTENDANCE TRACKING & POINT AWARDS

### 5.1 Check-In Flow

1. Staff scans customer's QR / ticket at the door, or customer self-checks-in via app
2. `EventsService.checkIn()` is called
3. Validates: event is PUBLISHED or COMPLETED (allow late check-in), RSVP exists (or walk-in allowed for public events)
4. Prevents duplicate check-in (unique constraint on `[eventId, userId]`)
5. Determines point award:
   - If `event.earnRuleAction` is set → lookup `LoyaltyEarnRule` by action for dynamic points
   - Otherwise use `event.attendancePoints` (default 100)
6. Awards points via `LoyaltyWalletService.applyDelta`:

```typescript
const tx = await this.loyalty.applyDelta({
  membershipId: membership.id,
  type: 'EARN',
  points: pointsToAward,
  source: 'EVENT',
  sourceId: event.id,
  description: `Attended: ${event.title}`,
});
```

7. Recalculates tier: `await this.tiers.recalculateTier(membership.id)`
8. Creates `EventAttendance` record with `transactionId: tx.id`
9. Emits `EVENT_ATTENDED` to `MarketingEventBus` with metadata:

```typescript
await this.marketingBus?.emit('EVENT_ATTENDED', userId, {
  eventId: event.id,
  eventTitle: event.title,
  pointsEarned: pointsToAward,
  eventType: event.type,
  storeId: event.storeId,
});
```

### 5.2 Walk-In Handling

If a public event has no RSVP for the user:
- Create an ad-hoc RSVP with `status: 'CONFIRMED'` + immediate attendance
- The RSVP ticketCode is generated but the user arrived without it

### 5.3 Staff Check-In Endpoint

`POST /admin/events/:id/check-in` — accepts `{ userId }` or `{ ticketCode }`, records `checkedInBy` as the admin user ID, method as `MANUAL` or `TICKET_SCAN`.

---

## 6. TIER-BASED ACCESS CONTROL

### 6.1 Event Visibility Rules

| Scenario | `minTierLevel` | `allowedTierIds` | Who Can See & RSVP |
|----------|----------------|-------------------|--------------------|
| Open to all | 0 | `[]` | Any Enchanted Circle member |
| Dragon Keeper+ only | 4 | `[]` | Users with tier level ≥ 4 |
| Invite-only (specific tiers) | 0 | `['tier-id-1', 'tier-id-2']` | Only members of those tiers |
| VIP + Council | 5 | `[]` | Archmage Circle and Council of Realms |

### 6.2 Customer Event Listing

The `GET /events` endpoint must filter out events the customer cannot access:
- Load user's tier level
- Exclude events where `minTierLevel > userTierLevel`
- Exclude events where `allowedTierIds` is non-empty and doesn't include the user's `tierId`
- Exclude DRAFT and CANCELLED events
- Hide `virtualUrl` until the user has a CONFIRMED RSVP

### 6.3 Visibility Badge

Frontend shows a tier badge on restricted events:
- "Dragon Keeper+ Only" for `minTierLevel: 4`
- "VIP Experience" for `minTierLevel: 5`
- "Exclusive Event" when `allowedTierIds` is set
- No badge for public events

---

## 7. EVENT REMINDERS & NOTIFICATION JOBS

### 7.1 Event Reminder Job

**File:** `services/api/src/events/jobs/event.jobs.ts`

```typescript
@Injectable()
export class EventJobsService implements OnModuleInit {
  constructor(
    private queue: QueueService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private bus?: MarketingEventBus,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.EVENT_REMINDER, async () => {
      await this.sendReminders();
    });

    this.queue.registerProcessor(JobType.EVENT_ATTENDANCE_RECONCILE, async () => {
      await this.reconcileAttendance();
    });

    await this.queue.addRepeatable(
      JobType.EVENT_REMINDER,
      {},
      config.get('EVENT_REMINDER_CRON', '0 9 * * *'), // Daily at 9 AM
    );

    await this.queue.addRepeatable(
      JobType.EVENT_ATTENDANCE_RECONCILE,
      {},
      config.get('EVENT_RECONCILE_CRON', '0 1 * * *'), // Daily at 1 AM
    );
  }
}
```

### 7.2 Reminder Logic

Run daily. For each PUBLISHED event:
1. **24 hours before:** Find events starting in 23–25 hours. Send `EVENT_REMINDER` notification to all CONFIRMED RSVPs who haven't been reminded (tracked via `metadata.reminded24h` on RSVP).
2. **2 hours before:** Same for 1.5–2.5 hour window. Track via `metadata.reminded2h`.
3. **Event just started (virtual):** For VIRTUAL/HYBRID events starting in the last 15 min, send "Join now" with the `virtualUrl`.

Use `NotificationsService.sendNotificationToUser` with type `EVENT_REMINDER`.

Also emit `EVENT_REMINDER_DUE` to `MarketingEventBus` if you want journeys to handle reminders via multi-channel messaging (email + push + WhatsApp).

### 7.3 Attendance Reconciliation

Run nightly. For completed events:
1. Find all events where `endsAt < now - 2 hours` and `status = 'PUBLISHED'`
2. Auto-set status to `COMPLETED`
3. Mark CONFIRMED RSVPs with no attendance record as `NO_SHOW`

---

## 8. MARKETING JOURNEY INTEGRATION

### 8.1 New Events Emitted

| Event Name | Emitted When | Payload |
|-----------|-------------|---------|
| `EVENT_PUBLISHED` | Admin publishes an event | `{ eventId, eventTitle, eventType, startsAt, storeId, fandomId, minTierLevel }` |
| `EVENT_RSVP` | Customer RSVPs | `{ eventId, eventTitle, rsvpStatus, ticketCode, startsAt }` |
| `EVENT_ATTENDED` | Check-in recorded | `{ eventId, eventTitle, pointsEarned, eventType, storeId }` |
| `EVENT_CANCELLED` | Admin cancels event | `{ eventId, eventTitle, reason }` |
| `EVENT_REMINDER_DUE` | Reminder cron fires | `{ eventId, eventTitle, startsAt, hoursUntil }` |

### 8.2 Pre-Built Journey (Seed)

**Post-RSVP confirmation series** (`event-rsvp-confirmation`):

| Step | Type | Channel | Template | Delay |
|------|------|---------|----------|-------|
| 0 | SEND | EMAIL | `event_rsvp_confirmation` | — |
| 1 | WAIT | — | — | until 24h before event (`delayMinutes` computed from event date) |
| 2 | SEND | EMAIL + PUSH | `event_reminder_24h` | — |
| 3 | WAIT | — | — | until 2h before event |
| 4 | SEND | PUSH | `event_starting_soon` | — |
| 5 | SEND | EMAIL | `event_thankyou` | 1440 (24h after event) |

**Note:** For this journey, `delayMinutes` on steps 1 and 3 should be dynamically computed from the event's `startsAt`. Since the journey engine uses fixed delays, the **EVENT_REMINDER cron job** (§7) handles the time-relative reminders instead. The seed journey uses the cron-independent fallback approach: step 1 is a 48h wait, step 3 is a 22h wait (70h total from RSVP, approximating 3 days before typical event).

### 8.3 Template Slugs for Events

| Slug | Channel | Subject |
|------|---------|---------|
| `event_rsvp_confirmation` | EMAIL | Your RSVP is Confirmed! |
| `event_reminder_24h` | EMAIL | Tomorrow: {{eventTitle}} |
| `event_starting_soon` | PUSH | Starting soon: {{eventTitle}} |
| `event_thankyou` | EMAIL | Thanks for Attending {{eventTitle}}! |
| `event_cancelled_notice` | EMAIL | Event Cancelled: {{eventTitle}} |
| `event_waitlist_promoted` | EMAIL | You're In! {{eventTitle}} |

Add these to the `BUILT_IN_TEMPLATES` array in `services/api/src/templates/templates.service.ts`.

---

## 9. REST API ENDPOINTS (Customer)

### 9.1 Events Controller

**File:** `services/api/src/events/events.controller.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/events` | `@Public()` | List upcoming published events (paginated, filterable by store/fandom/type) |
| `GET` | `/events/:slug` | `@Public()` | Get event detail by slug (hide virtualUrl if not RSVP'd) |
| `POST` | `/events/:id/rsvp` | `CUSTOMER` | RSVP to an event |
| `DELETE` | `/events/:id/rsvp` | `CUSTOMER` | Cancel RSVP |
| `POST` | `/events/:id/check-in` | `CUSTOMER` | Self check-in (QR scan or ticket code) |
| `GET` | `/events/my-rsvps` | `CUSTOMER` | List current user's RSVPs with event details |
| `GET` | `/events/my-attendances` | `CUSTOMER` | List events the user has attended |

### 9.2 Response Shapes

**Event listing item:**

```typescript
{
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  type: string;
  status: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  store: { id: string; name: string; city: string } | null;
  fandom: { id: string; name: string; slug: string } | null;
  capacity: number | null;
  rsvpCount: number;
  spotsLeft: number | null; // capacity - rsvpCount, null if unlimited
  attendancePoints: number;
  minTierLevel: number;
  tags: string[];
  tierRestricted: boolean; // true if minTierLevel > 0 or allowedTierIds non-empty
  userCanRsvp: boolean;    // computed for authenticated users
}
```

**Event detail (hide `virtualUrl` for non-RSVP'd users):**

```typescript
{
  ...listingFields,
  description: string;
  doorsOpenAt: string | null;
  hostName: string | null;
  hostBio: string | null;
  agenda: { time: string; title: string; description?: string }[];
  virtualUrl: string | null; // only if user has CONFIRMED RSVP
  requiresTicket: boolean;
  ticketPrice: number | null;
  ticketCurrency: string;
  userRsvp: { id: string; status: string; ticketCode: string; guestCount: number } | null;
  userAttended: boolean;
}
```

---

## 10. ADMIN API ENDPOINTS

### 10.1 Events Admin Controller

**File:** `services/api/src/events/events-admin.controller.ts`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/events` | List all events (any status, paginated, filterable) |
| `GET` | `/admin/events/:id` | Get event detail with stats |
| `POST` | `/admin/events` | Create event (DRAFT status) |
| `PATCH` | `/admin/events/:id` | Update event |
| `POST` | `/admin/events/:id/publish` | Set status to PUBLISHED |
| `POST` | `/admin/events/:id/cancel` | Cancel event (notifies all RSVPs) |
| `POST` | `/admin/events/:id/complete` | Mark event as COMPLETED |
| `DELETE` | `/admin/events/:id` | Delete event (only DRAFT) |
| `GET` | `/admin/events/:id/rsvps` | List all RSVPs for event |
| `GET` | `/admin/events/:id/attendances` | List all attendance records |
| `POST` | `/admin/events/:id/check-in` | Staff check-in: `{ userId }` or `{ ticketCode }` |
| `GET` | `/admin/events/:id/stats` | Event statistics |
| `POST` | `/admin/events/:id/invite` | Send targeted invitations to a tier/segment |

### 10.2 Bulk Invite Logic

`POST /admin/events/:id/invite` accepts:

```typescript
{
  tierIds?: string[];        // Invite specific tiers
  minTierLevel?: number;     // Invite tier level and above
  fandomId?: string;         // Filter by fandom affinity
  limit?: number;            // Max invites to send (default 500)
}
```

Logic:
1. Build `where` clause on `LoyaltyMembership` matching filters
2. Fetch matching members (up to limit)
3. For each member, send `EVENT_INVITATION` notification
4. Emit `EVENT_INVITATION_SENT` to marketing bus for journey triggers
5. Return `{ invited: number, alreadyRsvped: number }`

---

## 11. FRONTEND PAGES (Customer)

### 11.1 Events Listing — `apps/web/src/app/events/page.tsx`

- Grid of upcoming event cards
- Filter bar: Store dropdown, Fandom dropdown, Type pills (All / In-Store / Virtual / VIP)
- Each card shows: image, title, date/time, store name, fandom badge, "X spots left", attendance points badge, tier restriction badge
- "RSVP" button (disabled if tier-restricted + not eligible)
- Pagination

### 11.2 Event Detail — `apps/web/src/app/events/[slug]/page.tsx`

- Hero banner image
- Title, date/time/timezone, store name + map link (if physical), fandom badge
- Description, host info, agenda timeline
- Capacity bar (visual: "42 of 100 spots filled")
- RSVP section:
  - If not RSVP'd: "RSVP" button + guest count selector
  - If RSVP'd: show ticket code (QR renderable), status, "Cancel RSVP" button
  - If tier-restricted + not eligible: show lock icon + "Upgrade to [tier] to attend"
- For virtual events with CONFIRMED RSVP: show "Join Event" button (visible from doorsOpenAt)
- Attendance points callout: "Earn 100 Enchanted Points by attending!"

### 11.3 My Events — `apps/web/src/app/events/my-events/page.tsx`

- Tabs: "Upcoming" (RSVPs where event.startsAt > now) | "Past" (attended events)
- Upcoming: event card + ticket code + "Cancel" button
- Past: event card + "✓ Attended — earned X points" badge

### 11.4 Customer Loyalty Dashboard Update

**Modify `apps/web/src/app/loyalty/page.tsx`:**

Add link: "My Events" → `/events/my-events`

### 11.5 QR Check-In Page — `apps/web/src/app/events/check-in/page.tsx`

Simple page that:
1. Shows QR scanner (use `html5-qrcode` library or camera API)
2. Decodes scanned data (ticket code or event URL)
3. Calls `POST /events/:id/check-in` with the ticket code
4. Shows success animation + points earned

---

## 12. FRONTEND PAGES (Admin)

### 12.1 Events List — `apps/web/src/app/admin/events/page.tsx`

- Table with columns: Title, Type, Store, Date, Status, RSVPs, Capacity
- Status filter pills: All / Draft / Published / Completed / Cancelled
- "Create Event" button
- Row actions: View / Edit / Publish / Cancel

### 12.2 Event Create/Edit — `apps/web/src/app/admin/events/new/page.tsx` and `apps/web/src/app/admin/events/[id]/edit/page.tsx`

- Form with fields matching `CreateEventDto`
- Store selector dropdown (from stores API)
- Fandom selector dropdown (from fandoms API)
- Tier restriction configurator (minTierLevel slider + multi-select for allowedTierIds)
- Agenda builder (dynamic rows: time + title + description)
- Image upload for banner/image
- Date/time pickers with timezone selector

### 12.3 Event Detail — `apps/web/src/app/admin/events/[id]/page.tsx`

- Tabs: Details | RSVPs | Attendance | Stats
- **Details tab:** Read-only view + action buttons (Publish, Cancel, Complete, Edit)
- **RSVPs tab:** Table of RSVPs with: user name/email, status, guest count, ticket code, RSVP date. Search by name/email. Manual check-in button per row.
- **Attendance tab:** Table of attendees with: user name, check-in time, method, points awarded
- **Stats tab:** Dashboard cards (confirmed RSVPs, waitlisted, attended, no-shows, total points awarded, capacity utilisation %)

### 12.4 Admin Sidebar Update

**Modify `apps/web/src/components/AdminLayout.tsx`:**

Add to `menuItems` array (after Marketing automation section):

```typescript
{
  title: 'Events',
  icon: '🎪',
  children: [
    { title: 'All events', href: '/admin/events', icon: '📅' },
    { title: 'Create event', href: '/admin/events/new', icon: '➕' },
  ],
},
```

---

## 13. API CLIENT EXTENSIONS

**File:** `packages/api-client/src/client.ts`

Add the following methods:

```typescript
// ── Customer Events ──
async getEvents(params?: {
  storeId?: string; fandomId?: string; type?: string; page?: number; limit?: number;
}): Promise<ApiResponse<unknown>>;

async getEventBySlug(slug: string): Promise<ApiResponse<unknown>>;

async rsvpEvent(eventId: string, body?: {
  guestCount?: number; notes?: string;
}): Promise<ApiResponse<unknown>>;

async cancelEventRsvp(eventId: string): Promise<ApiResponse<unknown>>;

async checkInEvent(eventId: string, body?: {
  ticketCode?: string; method?: string;
}): Promise<ApiResponse<unknown>>;

async getMyEventRsvps(): Promise<ApiResponse<unknown>>;

async getMyEventAttendances(): Promise<ApiResponse<unknown>>;

// ── Admin Events ──
async adminListEvents(params?: {
  status?: string; storeId?: string; page?: number; limit?: number;
}): Promise<ApiResponse<unknown>>;

async adminGetEvent(id: string): Promise<ApiResponse<unknown>>;

async adminCreateEvent(body: Record<string, unknown>): Promise<ApiResponse<unknown>>;

async adminUpdateEvent(id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>>;

async adminPublishEvent(id: string): Promise<ApiResponse<unknown>>;

async adminCancelEvent(id: string, body?: { reason?: string }): Promise<ApiResponse<unknown>>;

async adminCompleteEvent(id: string): Promise<ApiResponse<unknown>>;

async adminDeleteEvent(id: string): Promise<ApiResponse<unknown>>;

async adminGetEventRsvps(id: string): Promise<ApiResponse<unknown>>;

async adminGetEventAttendances(id: string): Promise<ApiResponse<unknown>>;

async adminCheckInEvent(id: string, body: {
  userId?: string; ticketCode?: string;
}): Promise<ApiResponse<unknown>>;

async adminGetEventStats(id: string): Promise<ApiResponse<unknown>>;

async adminInviteToEvent(id: string, body: {
  tierIds?: string[]; minTierLevel?: number; fandomId?: string; limit?: number;
}): Promise<ApiResponse<unknown>>;
```

---

## 14. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```typescript
interface EnvSchema {
  // ... existing ...
  EVENT_REMINDER_CRON?: string;        // Default: '0 9 * * *' (daily 9 AM)
  EVENT_RECONCILE_CRON?: string;       // Default: '0 1 * * *' (daily 1 AM)
  EVENT_DEFAULT_POINTS?: string;       // Default: '100'
  EVENT_MAX_GUEST_COUNT?: string;      // Default: '5'
}
```

No external API keys required for Phase 5. Events use existing infrastructure (SMTP, push, WhatsApp).

---

## 15. TESTING STRATEGY

### 15.1 Unit Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `events/events.service.spec.ts` | 12 | create, publish, cancel, complete, rsvp (capacity + tier check), cancelRsvp (waitlist promotion), checkIn (points + dedup), walk-in, getEventStats, findUpcoming (tier filtering) |
| `events/events.controller.spec.ts` | 5 | list, detail with virtualUrl hidden, RSVP, cancel RSVP, self check-in |
| `events/events-admin.controller.spec.ts` | 5 | CRUD, publish, staff check-in, bulk invite, stats |
| `events/jobs/event.jobs.spec.ts` | 4 | 24h reminder sent, 2h reminder sent, virtual "join now", attendance reconciliation (no-show marking) |

**Total: ≥ 26 new tests**

### 15.2 Key Test Scenarios

1. **Tier-restricted RSVP denied:** Create event with `minTierLevel: 4`, attempt RSVP with Initiate-tier user → expect 403
2. **Capacity overflow → waitlist:** Create event with `capacity: 2`, RSVP 2 users confirmed, 3rd user → expect WAITLISTED
3. **Waitlist promotion on cancel:** Cancel 1st RSVP → 3rd user promoted to CONFIRMED + notification sent
4. **Duplicate check-in prevented:** Check in same user twice → expect 409 conflict
5. **Points awarded on check-in:** Check in → verify `LoyaltyTransaction` created with `source: 'EVENT'` and `points: event.attendancePoints`
6. **Walk-in creates ad-hoc RSVP:** Public event, no RSVP → check-in still succeeds, RSVP created automatically
7. **Virtual URL hidden before RSVP:** Get event detail without RSVP → `virtualUrl: null`
8. **No-show reconciliation:** Event ended 3h ago, RSVP CONFIRMED but no attendance → status set to NO_SHOW

### 15.3 Test Commands

```bash
npx jest --testPathPattern="events" --no-cache --forceExit
```

---

## 16. MIGRATION & SEED SCRIPT

### 16.1 Migration

File: `services/api/prisma/migrations/20260520000000_phase5_event_management/migration.sql` (see §2.5)

### 16.2 Event Seed

Create `services/api/prisma/seeds/event-seed.ts`:

Seed sample events for development:

```typescript
const events = [
  {
    title: 'Harry Potter Wand Making Workshop',
    slug: 'hp-wand-making-workshop',
    type: 'IN_STORE',
    description: 'Join us for an interactive wand-making experience...',
    shortDescription: 'Create your own custom wand with our master craftsmen',
    storeId: /* lookup Soho store */,
    fandomId: /* lookup Harry Potter fandom */,
    startsAt: new Date('2026-06-15T14:00:00Z'),
    endsAt: new Date('2026-06-15T16:00:00Z'),
    capacity: 30,
    attendancePoints: 150,
    minTierLevel: 0,
    tags: ['harry-potter', 'workshop', 'family'],
    hostName: 'Master Ollivander (Dave)',
    status: 'PUBLISHED',
  },
  {
    title: 'Dragon Keeper VIP After-Hours Experience',
    slug: 'dragon-keeper-vip-after-hours',
    type: 'VIP_EXPERIENCE',
    description: 'An exclusive after-hours shopping event for Dragon Keeper+ members...',
    shortDescription: 'VIP shopping with exclusive previews and champagne',
    storeId: /* lookup flagship store */,
    startsAt: new Date('2026-06-20T19:00:00Z'),
    endsAt: new Date('2026-06-20T22:00:00Z'),
    capacity: 50,
    attendancePoints: 250,
    minTierLevel: 4, // Dragon Keeper+
    tags: ['vip', 'exclusive', 'shopping'],
    status: 'PUBLISHED',
  },
  {
    title: 'Wizarding World Trivia Night — Virtual Edition',
    slug: 'wizarding-trivia-virtual',
    type: 'VIRTUAL',
    description: 'Test your wizarding knowledge against fellow fans worldwide...',
    shortDescription: 'Live virtual trivia night with prizes',
    virtualUrl: 'https://zoom.us/j/placeholder',
    virtualPlatform: 'ZOOM',
    fandomId: /* lookup Harry Potter fandom */,
    startsAt: new Date('2026-06-25T19:00:00Z'),
    endsAt: new Date('2026-06-25T21:00:00Z'),
    attendancePoints: 100,
    minTierLevel: 0,
    tags: ['trivia', 'virtual', 'harry-potter'],
    status: 'PUBLISHED',
  },
  {
    title: 'Marvel Cosplay Meetup — Times Square',
    slug: 'marvel-cosplay-nyc',
    type: 'FAN_MEETUP',
    description: 'Assemble at our Times Square flagship in your best Marvel cosplay...',
    shortDescription: 'Cosplay meetup with prizes and photo ops',
    storeId: /* lookup NYC store */,
    fandomId: /* lookup Marvel fandom */,
    startsAt: new Date('2026-07-04T12:00:00Z'),
    endsAt: new Date('2026-07-04T17:00:00Z'),
    capacity: 200,
    attendancePoints: 100,
    minTierLevel: 0,
    tags: ['marvel', 'cosplay', 'nyc'],
    status: 'DRAFT',
  },
  {
    title: 'New Product Launch — Enchanted Wands Collection',
    slug: 'enchanted-wands-launch',
    type: 'PRODUCT_LAUNCH',
    description: 'Be the first to see and purchase our new Enchanted Wands collection...',
    shortDescription: 'Exclusive first look at new wand designs',
    storeId: /* lookup Soho store */,
    startsAt: new Date('2026-07-10T11:00:00Z'),
    endsAt: new Date('2026-07-10T18:00:00Z'),
    attendancePoints: 100,
    minTierLevel: 2, // Spellcaster+
    tags: ['product-launch', 'wands', 'exclusive'],
    status: 'DRAFT',
  },
];
```

Add to `services/api/package.json`:

```json
"db:seed-events": "ts-node prisma/seeds/event-seed.ts"
```

### 16.3 LoyaltyEarnRule Seed Entry

Ensure an `EVENT_ATTENDANCE` earn rule exists. Add to `services/api/prisma/seeds/loyalty-seed.ts` (or the event seed):

```typescript
await prisma.loyaltyEarnRule.upsert({
  where: { action: 'EVENT_ATTENDANCE' },
  update: {},
  create: {
    name: 'Event Attendance',
    action: 'EVENT_ATTENDANCE',
    pointsAmount: 100,
    pointsType: 'FIXED',
    multiplierStack: true,
    maxPerDay: 2,
    isActive: true,
  },
});
```

---

## 17. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Admin can create events (all types) | Create IN_STORE, VIRTUAL, VIP_EXPERIENCE events via admin API |
| 2 | Admin can publish → cancel → complete lifecycle | Verify status transitions and notifications on cancel |
| 3 | Customer sees only tier-eligible events | Create Dragon Keeper event, verify Initiate member cannot see it |
| 4 | RSVP respects capacity limits | Fill event to capacity, verify next RSVP is WAITLISTED |
| 5 | Waitlist promotion works on cancellation | Cancel confirmed RSVP → verify first waitlisted promoted |
| 6 | Ticket code generated on RSVP | RSVP → verify 8-char unique ticketCode returned |
| 7 | Check-in awards loyalty points | Check in → verify `LoyaltyTransaction` with `source: 'EVENT'` created |
| 8 | Check-in triggers tier recalculation | Check in → verify tier engine runs |
| 9 | Duplicate check-in prevented | Check in same user twice → verify 409 error |
| 10 | Walk-in creates ad-hoc RSVP | Public event, no prior RSVP → check in succeeds with auto RSVP |
| 11 | Staff can check in by ticket code | `POST /admin/events/:id/check-in { ticketCode }` → verify attendance |
| 12 | Virtual URL hidden until RSVP confirmed | GET event without RSVP → `virtualUrl: null` |
| 13 | Event reminders sent (24h + 2h before) | Run reminder job → verify notifications created for upcoming events |
| 14 | Attendance reconciliation marks no-shows | End event → run reconciliation → verify CONFIRMED without attendance → NO_SHOW |
| 15 | Marketing journey triggers on RSVP | RSVP → verify `EVENT_RSVP` event emitted to MarketingEventBus |
| 16 | Marketing journey triggers on attendance | Check in → verify `EVENT_ATTENDED` event emitted |
| 17 | Admin can bulk invite by tier | `POST /admin/events/:id/invite { minTierLevel: 4 }` → verify invitations sent |
| 18 | Event stats are accurate | Check RSVPs, attendances, no-shows, points totals via admin stats endpoint |
| 19 | Customer can view "My Events" (upcoming + past) | Verify `/events/my-events` shows correct data |
| 20 | Admin sidebar shows Events section | Verify "Events" with sub-links appears in AdminLayout |
| 21 | ≥ 26 unit tests passing | `npx jest --testPathPattern="events"` |
| 22 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 23 | Prisma schema validates | `npx prisma validate` |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (3 new models, User/Store/Fandom additions)
│   ├── migrations/
│   │   └── 20260520000000_phase5_event_management/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── event-seed.ts                                # NEW
├── src/
│   ├── events/
│   │   ├── events.module.ts                             # NEW
│   │   ├── events.service.ts                            # NEW
│   │   ├── events.service.spec.ts                       # NEW
│   │   ├── events.controller.ts                         # NEW (customer-facing)
│   │   ├── events.controller.spec.ts                    # NEW
│   │   ├── events-admin.controller.ts                   # NEW
│   │   ├── events-admin.controller.spec.ts              # NEW
│   │   ├── dto/
│   │   │   ├── create-event.dto.ts                      # NEW
│   │   │   ├── update-event.dto.ts                      # NEW
│   │   │   ├── rsvp-event.dto.ts                        # NEW
│   │   │   └── check-in.dto.ts                          # NEW
│   │   └── jobs/
│   │       ├── event.jobs.ts                            # NEW
│   │       └── event.jobs.spec.ts                       # NEW
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (2 new job types)
│   ├── templates/
│   │   └── templates.service.ts                         # MODIFIED (6 new event templates)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (Phase 5 env vars)
│   └── app.module.ts                                    # MODIFIED (add EventsModule)
├── package.json                                         # MODIFIED (seed script)

apps/web/src/
├── app/
│   ├── events/
│   │   ├── page.tsx                                     # NEW — event listing
│   │   ├── [slug]/
│   │   │   └── page.tsx                                 # NEW — event detail
│   │   ├── my-events/
│   │   │   └── page.tsx                                 # NEW — my RSVPs + past events
│   │   └── check-in/
│   │       └── page.tsx                                 # NEW — QR check-in
│   ├── loyalty/
│   │   └── page.tsx                                     # MODIFIED — add "My Events" link
│   └── admin/
│       └── events/
│           ├── page.tsx                                 # NEW — event list
│           ├── new/
│           │   └── page.tsx                             # NEW — create event
│           └── [id]/
│               ├── page.tsx                             # NEW — event detail (tabs)
│               └── edit/
│                   └── page.tsx                         # NEW — edit event
├── components/
│   └── AdminLayout.tsx                                  # MODIFIED — add Events section

packages/api-client/src/
└── client.ts                                            # MODIFIED (18 new event methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add 3 new models (Event, EventRSVP, EventAttendance), User/Store/Fandom relations, run migration, regenerate Prisma
2. **JobType additions** — Add `EVENT_REMINDER` and `EVENT_ATTENDANCE_RECONCILE` to `queue.bullmq.impl.ts`
3. **DTOs** — Create all 4 DTO files with class-validator decorators
4. **EventsService** — Core service with CRUD, RSVP (capacity + tier + waitlist), check-in (points + dedup), stats
5. **Events controllers** — Customer (`events.controller.ts`) + Admin (`events-admin.controller.ts`)
6. **EventsModule** — Wire module with imports (Database, Config, Queue, Loyalty, Journey, Notifications)
7. **Event jobs** — Reminder cron (24h + 2h) + attendance reconciliation (no-show marking)
8. **Template additions** — Add 6 event template slugs to `TemplatesService.BUILT_IN_TEMPLATES`
9. **Wire to app** — Import `EventsModule` in `app.module.ts`
10. **Env vars** — Add Phase 5 env vars to `env.validation.ts`
11. **Marketing bus events** — Emit `EVENT_RSVP`, `EVENT_ATTENDED`, `EVENT_PUBLISHED`, `EVENT_CANCELLED` from service
12. **API Client** — Add 18 new methods to `packages/api-client/src/client.ts`
13. **Frontend (customer)** — Event listing, detail, my-events, check-in pages
14. **Frontend (admin)** — Event list, create/edit, detail with tabs (RSVPs/Attendance/Stats), sidebar update
15. **Seed script** — Sample events + EVENT_ATTENDANCE earn rule
16. **Unit tests** — ≥ 26 tests across 4 spec files
17. **Build verification** — `npx tsc --noEmit && npx jest --testPathPattern="events" && npx prisma validate`

---

**End of Phase 5 Build Spec**
