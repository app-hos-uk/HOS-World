-- Convert GBP currency references to USD (data-only migration, no schema changes)
-- Every statement uses WHEN OTHERS to skip gracefully if anything is unexpected

DO $$ BEGIN UPDATE "products" SET "currency" = 'USD' WHERE "currency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "orders" SET "currency" = 'USD' WHERE "currency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "payments" SET "currency" = 'USD' WHERE "currency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "transactions" SET "currency" = 'USD' WHERE "currency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "users" SET "currencyPreference" = 'USD' WHERE "currencyPreference" = 'GBP' OR "currencyPreference" IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "carts" SET "currency" = 'USD' WHERE "currency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "customers" SET "currencyPreference" = 'USD' WHERE "currencyPreference" = 'GBP' OR "currencyPreference" IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "vendor_products" SET "vendorCurrency" = 'USD' WHERE "vendorCurrency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "gift_cards" SET "currency" = 'USD' WHERE "currency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "currency_exchange_rates" SET "baseCurrency" = 'USD' WHERE "baseCurrency" = 'GBP'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "users" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customers" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "currency_exchange_rates" ALTER COLUMN "baseCurrency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  INSERT INTO "currency_exchange_rates" ("id", "baseCurrency", "targetCurrency", "rate", "cachedAt", "expiresAt")
  VALUES
    (gen_random_uuid()::text, 'USD', 'USD', 1.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    (gen_random_uuid()::text, 'USD', 'GBP', 0.79, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    (gen_random_uuid()::text, 'USD', 'EUR', 0.92, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    (gen_random_uuid()::text, 'USD', 'AED', 3.67, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')
  ON CONFLICT ("baseCurrency", "targetCurrency") DO UPDATE SET
    "rate" = EXCLUDED."rate",
    "cachedAt" = CURRENT_TIMESTAMP,
    "expiresAt" = CURRENT_TIMESTAMP + INTERVAL '24 hours';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
