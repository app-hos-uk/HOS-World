-- Phase 5: Event & Experience Management

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
