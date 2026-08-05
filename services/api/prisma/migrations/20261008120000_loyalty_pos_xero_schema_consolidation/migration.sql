-- Consolidated schema for loyalty ↔ Lightspeed identity, POS voucher bridge, and Xero outbox.
-- Idempotent where practical so shadow DB / re-runs do not fail.

-- ---------------------------------------------------------------------------
-- User: E.164 normalised phone (indexed, not unique)
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT;

CREATE INDEX IF NOT EXISTS "users_phoneNormalized_idx" ON "users"("phoneNormalized");

-- ---------------------------------------------------------------------------
-- LoyaltyTransaction: idempotency + compound lookup index
-- ---------------------------------------------------------------------------
ALTER TABLE "loyalty_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Caller-controlled uniqueness (must encode slice discriminators for multi-campaign earns).
-- Do NOT unique (membershipId, source, sourceId): earn.engine writes multiple rows per order
-- (one per product campaign slice + optional click-collect bonus) with the same sourceId.
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_transactions_idempotencyKey_key"
  ON "loyalty_transactions"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "loyalty_transactions_membershipId_source_sourceId_idx"
  ON "loyalty_transactions"("membershipId", "source", "sourceId");

-- ---------------------------------------------------------------------------
-- POSConnection: durable sales-import cursor
-- ---------------------------------------------------------------------------
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "lastSaleImportedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- ExternalEntityMapping: close NULL unique-index hole + account-level key
-- ---------------------------------------------------------------------------
ALTER TABLE "external_entity_mappings" ADD COLUMN IF NOT EXISTS "accountKey" TEXT;

-- Surface duplicate NULL-storeId groups before collapsing the NULL unique-index hole.
-- If any exist, fail the migration so they can be merged manually rather than aborting mid-UPDATE.
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT 1
    FROM "external_entity_mappings"
    WHERE "storeId" IS NULL
    GROUP BY "provider", "entityType", "internalId"
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'external_entity_mappings has % duplicate NULL-storeId group(s) on (provider, entityType, internalId); merge before re-running',
      dup_count;
  END IF;

  SELECT COUNT(*) INTO dup_count FROM (
    SELECT 1
    FROM "external_entity_mappings"
    WHERE "storeId" IS NULL
    GROUP BY "provider", "entityType", "externalId"
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'external_entity_mappings has % duplicate NULL-storeId group(s) on (provider, entityType, externalId); merge before re-running',
      dup_count;
  END IF;
END $$;

UPDATE "external_entity_mappings" SET "storeId" = '' WHERE "storeId" IS NULL;

ALTER TABLE "external_entity_mappings" ALTER COLUMN "storeId" SET DEFAULT '';
ALTER TABLE "external_entity_mappings" ALTER COLUMN "storeId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "external_entity_mappings_provider_entityType_accountKey_idx"
  ON "external_entity_mappings"("provider", "entityType", "accountKey");

-- ---------------------------------------------------------------------------
-- LoyaltyPosVoucher
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "loyalty_pos_vouchers" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "clientId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_pos_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_pos_vouchers_redemptionId_key" ON "loyalty_pos_vouchers"("redemptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_pos_vouchers_clientId_key" ON "loyalty_pos_vouchers"("clientId");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_membershipId_idx" ON "loyalty_pos_vouchers"("membershipId");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_storeId_idx" ON "loyalty_pos_vouchers"("storeId");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_cardNumber_idx" ON "loyalty_pos_vouchers"("cardNumber");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_status_idx" ON "loyalty_pos_vouchers"("status");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_externalTransactionId_idx" ON "loyalty_pos_vouchers"("externalTransactionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_pos_vouchers_membershipId_fkey'
  ) THEN
    ALTER TABLE "loyalty_pos_vouchers"
      ADD CONSTRAINT "loyalty_pos_vouchers_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "loyalty_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_pos_vouchers_redemptionId_fkey'
  ) THEN
    ALTER TABLE "loyalty_pos_vouchers"
      ADD CONSTRAINT "loyalty_pos_vouchers_redemptionId_fkey"
      FOREIGN KEY ("redemptionId") REFERENCES "loyalty_redemptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RESTRICT on store: voucher rows are money records needed for Lightspeed/Xero recon.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_pos_vouchers_storeId_fkey'
  ) THEN
    ALTER TABLE "loyalty_pos_vouchers"
      ADD CONSTRAINT "loyalty_pos_vouchers_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- IdentityMatchReview
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "identity_match_reviews" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'lightspeed',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lightspeedCustomerId" TEXT,
    "email" TEXT,
    "phoneNormalized" TEXT,
    "cardNumber" TEXT,
    "proposedInternalId" TEXT,
    "candidateInternalIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_match_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "identity_match_reviews_status_idx" ON "identity_match_reviews"("status");
CREATE INDEX IF NOT EXISTS "identity_match_reviews_provider_status_idx" ON "identity_match_reviews"("provider", "status");
CREATE INDEX IF NOT EXISTS "identity_match_reviews_email_idx" ON "identity_match_reviews"("email");
CREATE INDEX IF NOT EXISTS "identity_match_reviews_phoneNormalized_idx" ON "identity_match_reviews"("phoneNormalized");
CREATE INDEX IF NOT EXISTS "identity_match_reviews_createdAt_idx" ON "identity_match_reviews"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'identity_match_reviews_resolvedById_fkey'
  ) THEN
    ALTER TABLE "identity_match_reviews"
      ADD CONSTRAINT "identity_match_reviews_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- LedgerOutboxEntry (HOS → Xero; never POSSale-derived)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ledger_outbox_entries" (
    "id" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "periodDate" DATE NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "xeroJournalId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_outbox_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_outbox_entries_idempotencyKey_key" ON "ledger_outbox_entries"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ledger_outbox_entries_status_createdAt_idx" ON "ledger_outbox_entries"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ledger_outbox_entries_entryType_periodDate_idx" ON "ledger_outbox_entries"("entryType", "periodDate");
