-- Point existing rows at the US market. Does not drop unique constraints and
-- does not set columns NOT NULL. LoyaltyMembership.userId stays unique.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "markets" WHERE "code" = 'US') THEN
    RAISE EXCEPTION 'markets row code=US is missing; refusing to backfill';
  END IF;
END $$;

UPDATE "product_submissions"
SET "marketId" = (SELECT "id" FROM "markets" WHERE "code" = 'US')
WHERE "marketId" IS NULL;

UPDATE "founding_members"
SET "marketId" = (SELECT "id" FROM "markets" WHERE "code" = 'US')
WHERE "marketId" IS NULL;

UPDATE "loyalty_memberships"
SET "marketId" = (SELECT "id" FROM "markets" WHERE "code" = 'US')
WHERE "marketId" IS NULL;

UPDATE "loyalty_tiers"
SET "marketId" = (SELECT "id" FROM "markets" WHERE "code" = 'US')
WHERE "marketId" IS NULL;

UPDATE "platform_settings"
SET "marketId" = (SELECT "id" FROM "markets" WHERE "code" = 'US')
WHERE "marketId" IS NULL;

UPDATE "integration_configs"
SET "marketId" = (SELECT "id" FROM "markets" WHERE "code" = 'US')
WHERE "marketId" IS NULL;

UPDATE "EmailTemplate"
SET "marketCode" = 'US'
WHERE "marketCode" IS NULL;
