-- Phase 6: Segmentation Engine

ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

ALTER TABLE "marketing_journeys" ADD COLUMN IF NOT EXISTS "segmentId" TEXT;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketing_journeys_segmentId_fkey'
  ) THEN
    ALTER TABLE "marketing_journeys"
      ADD CONSTRAINT "marketing_journeys_segmentId_fkey"
      FOREIGN KEY ("segmentId") REFERENCES "audience_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "marketing_journeys_segmentId_idx" ON "marketing_journeys"("segmentId");
