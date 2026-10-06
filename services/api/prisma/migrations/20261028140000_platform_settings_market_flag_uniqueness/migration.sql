-- Allow a global platform_settings row (marketId IS NULL) to coexist with
-- per-market overrides that share the same category and key.
-- Prisma cannot express partial unique indexes; application code uses
-- findFirst + create/update rather than upsert.

DROP INDEX IF EXISTS "platform_settings_category_key_key";

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_category_key_global_key"
  ON "platform_settings" ("category", "key")
  WHERE "marketId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_category_key_market_key"
  ON "platform_settings" ("category", "key", "marketId")
  WHERE "marketId" IS NOT NULL;
