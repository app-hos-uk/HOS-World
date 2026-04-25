-- Phase 3: Extended Earn Rules & Fandom Profiles

CREATE TABLE IF NOT EXISTS "fandom_quizzes" (
    "id" TEXT NOT NULL,
    "fandomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "pointsReward" INTEGER NOT NULL DEFAULT 25,
    "difficulty" TEXT NOT NULL DEFAULT 'EASY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fandom_quizzes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fandom_quizzes_fandomId_idx" ON "fandom_quizzes"("fandomId");
CREATE INDEX IF NOT EXISTS "fandom_quizzes_isActive_idx" ON "fandom_quizzes"("isActive");
DO $$ BEGIN
  ALTER TABLE "fandom_quizzes" ADD CONSTRAINT "fandom_quizzes_fandomId_fkey"
    FOREIGN KEY ("fandomId") REFERENCES "fandoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fandom_quiz_attempts" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fandom_quiz_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fandom_quiz_attempts_userId_idx" ON "fandom_quiz_attempts"("userId");
CREATE INDEX IF NOT EXISTS "fandom_quiz_attempts_quizId_userId_idx" ON "fandom_quiz_attempts"("quizId", "userId");
DO $$ BEGIN
  ALTER TABLE "fandom_quiz_attempts" ADD CONSTRAINT "fandom_quiz_attempts_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "fandom_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fandom_quiz_attempts" ADD CONSTRAINT "fandom_quiz_attempts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "loyalty_referrals" ADD COLUMN IF NOT EXISTS "convertedOrderId" TEXT;
ALTER TABLE "shared_items" ADD COLUMN IF NOT EXISTS "loyaltyPointsAwarded" INTEGER NOT NULL DEFAULT 0;
