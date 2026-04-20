-- Phase 4: Marketing Automation

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

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
