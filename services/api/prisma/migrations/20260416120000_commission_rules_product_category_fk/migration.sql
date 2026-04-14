-- Referential integrity for InfluencerCommissionRule optional scopes (orphan cleanup + FKs)

UPDATE "influencer_commission_rules" r
SET "productId" = NULL
WHERE r."productId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p.id = r."productId");

UPDATE "influencer_commission_rules" r
SET "categoryId" = NULL
WHERE r."categoryId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "categories" c WHERE c.id = r."categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_commission_rules_productId_fkey'
  ) THEN
    ALTER TABLE "influencer_commission_rules"
      ADD CONSTRAINT "influencer_commission_rules_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_commission_rules_categoryId_fkey'
  ) THEN
    ALTER TABLE "influencer_commission_rules"
      ADD CONSTRAINT "influencer_commission_rules_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
