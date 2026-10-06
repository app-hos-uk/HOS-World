-- Replace the category+provider unique key so a market can store its own
-- integration beside the global default (marketId IS NULL).

DROP INDEX IF EXISTS "integration_configs_category_provider_key";

-- Per-market rows: one row per (category, provider, market)
CREATE UNIQUE INDEX IF NOT EXISTS "integration_configs_category_provider_marketId_key"
ON "integration_configs" ("category", "provider", "marketId")
WHERE "marketId" IS NOT NULL;

-- Global (NULL market) rows: at most one per (category, provider)
CREATE UNIQUE INDEX IF NOT EXISTS "integration_configs_category_provider_null_market_key"
ON "integration_configs" ("category", "provider")
WHERE "marketId" IS NULL;
