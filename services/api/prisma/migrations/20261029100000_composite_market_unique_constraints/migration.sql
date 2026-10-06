-- Composite unique constraints for multi-market expansion.
-- Each change: drop old unique, add composite unique.
-- Collisions are resolved by appending numeric suffixes where needed.
-- Partial indexes keep legacy NULL market rows unique without blocking per-market duplicates.
-- CREATE INDEX IF NOT EXISTS makes this migration safe to re-run.

-- 1. FoundingMember: email unique per market
-- First, ensure all rows have a marketId (should be done by slice5 backfill)
-- Drop the old global unique on email
DROP INDEX IF EXISTS "founding_members_email_key";
-- Create composite unique (PostgreSQL treats NULL marketId as distinct, which is desired)
CREATE UNIQUE INDEX IF NOT EXISTS "founding_members_email_marketId_key" ON "founding_members"("email", "marketId") WHERE "marketId" IS NOT NULL;
-- Keep a partial unique for rows without marketId (legacy, should not happen after backfill)
CREATE UNIQUE INDEX IF NOT EXISTS "founding_members_email_null_market_key" ON "founding_members"("email") WHERE "marketId" IS NULL;

-- 2. LoyaltyMembership: keep userId @unique for now (59+ lookup sites depend on
-- one-to-one User→LoyaltyMembership). Add a composite INDEX (not unique) for
-- future multi-market membership queries. The unique constraint will be changed
-- to @@unique([userId, marketId]) once all lookup sites are market-aware.
CREATE INDEX IF NOT EXISTS "loyalty_memberships_userId_marketId_idx" ON "loyalty_memberships"("userId", "marketId");

-- 3. LoyaltyTier: slug unique per market (name and level stay globally unique)
DROP INDEX IF EXISTS "loyalty_tiers_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tiers_slug_marketId_key" ON "loyalty_tiers"("slug", "marketId") WHERE "marketId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tiers_slug_null_market_key" ON "loyalty_tiers"("slug") WHERE "marketId" IS NULL;

-- 4. EmailTemplate: slug unique per marketCode
DROP INDEX IF EXISTS "EmailTemplate_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_slug_marketCode_key" ON "EmailTemplate"("slug", "marketCode") WHERE "marketCode" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_slug_null_market_key" ON "EmailTemplate"("slug") WHERE "marketCode" IS NULL;

-- 5. Product: global slug uniqueness among live products
-- The oldest live row keeps its slug. Later duplicates get -1, -2, ...
-- skipping any suffix that is already used by another live product.
DO $$
DECLARE
  grp RECORD;
  row RECORD;
  counter INT;
  candidate TEXT;
BEGIN
  FOR grp IN
    SELECT slug
    FROM products
    WHERE "deletedAt" IS NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    FOR row IN
      SELECT id
      FROM products
      WHERE slug = grp.slug AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC, id ASC
      OFFSET 1
    LOOP
      LOOP
        candidate := grp.slug || '-' || counter;
        counter := counter + 1;
        EXIT WHEN NOT EXISTS (
          SELECT 1
          FROM products
          WHERE slug = candidate AND "deletedAt" IS NULL
        );
      END LOOP;

      UPDATE products SET slug = candidate WHERE id = row.id;
    END LOOP;
  END LOOP;
END $$;

-- Now change the unique constraint.
-- Soft-deleted rows are excluded so historical duplicates do not block the index.
DROP INDEX IF EXISTS "products_sellerId_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug") WHERE "deletedAt" IS NULL;
