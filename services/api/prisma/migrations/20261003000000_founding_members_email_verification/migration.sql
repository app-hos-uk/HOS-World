-- Add email verification fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifyToken" TEXT;

-- Unique index on emailVerifyToken (for fast lookup)
CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerifyToken_key" ON "users"("emailVerifyToken");

-- Create FoundingMember table
CREATE TABLE IF NOT EXISTS "founding_members" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "fandoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "otherFranchises" TEXT,
    "source" TEXT,
    "spendBracket" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "userId" TEXT,
    "referralSource" TEXT,
    "metadata" JSONB,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "founding_members_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "founding_members_email_key" ON "founding_members"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "founding_members_userId_key" ON "founding_members"("userId");

-- Performance indexes
CREATE INDEX IF NOT EXISTS "founding_members_email_idx" ON "founding_members"("email");
CREATE INDEX IF NOT EXISTS "founding_members_status_idx" ON "founding_members"("status");
CREATE INDEX IF NOT EXISTS "founding_members_registeredAt_idx" ON "founding_members"("registeredAt");

-- Foreign key to users table (optional linkage)
ALTER TABLE "founding_members"
    ADD CONSTRAINT IF NOT EXISTS "founding_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
