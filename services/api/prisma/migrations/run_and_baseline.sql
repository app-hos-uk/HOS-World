-- Combined Script: Run Migration + Baseline for Prisma
-- Run this entire script in Railway PostgreSQL service

-- ============================================
-- PART 1: Create Prisma Migrations Table
-- ============================================
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP,
    "started_at" TIMESTAMP NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- PART 2: Run the Actual Migration
-- ============================================

-- Step 1: Add new columns to users table
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT,
ADD COLUMN IF NOT EXISTS "preferredCommunicationMethod" TEXT,
ADD COLUMN IF NOT EXISTS "currencyPreference" TEXT DEFAULT 'GBP',
ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
ADD COLUMN IF NOT EXISTS "gdprConsent" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "gdprConsentDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "dataProcessingConsent" JSONB,
ADD COLUMN IF NOT EXISTS "countryDetectedAt" TIMESTAMP;

-- Step 2: Add new columns to customers table
ALTER TABLE "customers"
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "currencyPreference" TEXT DEFAULT 'GBP';

-- Step 3: Create CurrencyExchangeRate table
CREATE TABLE IF NOT EXISTS "currency_exchange_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "targetCurrency" TEXT NOT NULL,
    "rate" DECIMAL(10, 6) NOT NULL,
    "cachedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP NOT NULL,
    CONSTRAINT "currency_exchange_rates_baseCurrency_targetCurrency_key" UNIQUE ("baseCurrency", "targetCurrency")
);

-- Step 4: Create GDPRConsentLog table
CREATE TABLE IF NOT EXISTS "gdpr_consent_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "gdpr_consent_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS "currency_exchange_rates_baseCurrency_idx" ON "currency_exchange_rates"("baseCurrency");
CREATE INDEX IF NOT EXISTS "currency_exchange_rates_targetCurrency_idx" ON "currency_exchange_rates"("targetCurrency");
CREATE INDEX IF NOT EXISTS "currency_exchange_rates_expiresAt_idx" ON "currency_exchange_rates"("expiresAt");
CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_userId_idx" ON "gdpr_consent_logs"("userId");
CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_consentType_idx" ON "gdpr_consent_logs"("consentType");
CREATE INDEX IF NOT EXISTS "users_country_idx" ON "users"("country");
CREATE INDEX IF NOT EXISTS "users_currencyPreference_idx" ON "users"("currencyPreference");

-- Step 6: Update default currency from USD to GBP in existing tables
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- Step 7: Backfill currency preference for existing users
UPDATE "users" 
SET "currencyPreference" = 'GBP' 
WHERE "currencyPreference" IS NULL;

-- Step 8: Initialize default exchange rates
INSERT INTO "currency_exchange_rates" ("id", "baseCurrency", "targetCurrency", "rate", "cachedAt", "expiresAt")
VALUES 
    (gen_random_uuid()::text, 'GBP', 'GBP', 1.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    (gen_random_uuid()::text, 'GBP', 'USD', 1.27, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    (gen_random_uuid()::text, 'GBP', 'EUR', 1.17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    (gen_random_uuid()::text, 'GBP', 'AED', 4.67, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour')
ON CONFLICT ("baseCurrency", "targetCurrency") DO NOTHING;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN "users"."country" IS 'User country for global platform features';
COMMENT ON COLUMN "users"."whatsappNumber" IS 'WhatsApp contact number';
COMMENT ON COLUMN "users"."preferredCommunicationMethod" IS 'Preferred communication method: EMAIL, SMS, WHATSAPP, or PHONE';
COMMENT ON COLUMN "users"."currencyPreference" IS 'User preferred currency for price display (GBP, USD, EUR, AED)';
COMMENT ON COLUMN "users"."gdprConsent" IS 'GDPR consent status';
COMMENT ON COLUMN "users"."dataProcessingConsent" IS 'Granular consent preferences (JSON)';
COMMENT ON TABLE "currency_exchange_rates" IS 'Cached currency exchange rates with GBP as base currency';
COMMENT ON TABLE "gdpr_consent_logs" IS 'Audit log for GDPR consent changes';

-- ============================================
-- PART 3: Baseline the Migration
-- ============================================
-- Mark this migration as already applied so Prisma knows it's done
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '', -- Prisma will update this on next migration
    NOW(),
    '20251206133014_add_global_features',
    NOW(),
    1
) ON CONFLICT ("id") DO NOTHING;

-- ============================================
-- Migration Complete!
-- ============================================
-- After running this:
-- 1. The database will have all new columns and tables
-- 2. Prisma will know the migration is applied
-- 3. Future migrations will work normally
-- 4. Restart the API service to see "no pending migrations"

