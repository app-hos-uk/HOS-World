-- Convert all GBP currency references to USD across the platform
-- This is a data migration for the US market launch

-- Update product currencies
UPDATE "products" SET "currency" = 'USD' WHERE "currency" = 'GBP';

-- Update cart currencies
UPDATE "carts" SET "currency" = 'USD' WHERE "currency" = 'GBP';

-- Update order currencies
UPDATE "orders" SET "currency" = 'USD' WHERE "currency" = 'GBP';

-- Update payment currencies
UPDATE "payments" SET "currency" = 'USD' WHERE "currency" = 'GBP';

-- Update transaction currencies
UPDATE "transactions" SET "currency" = 'USD' WHERE "currency" = 'GBP';

-- Update user currency preferences
UPDATE "users" SET "currencyPreference" = 'USD' WHERE "currencyPreference" = 'GBP' OR "currencyPreference" IS NULL;

-- Update customer currency preferences
UPDATE "customers" SET "currencyPreference" = 'USD' WHERE "currencyPreference" = 'GBP' OR "currencyPreference" IS NULL;

-- Update vendor product currencies
UPDATE "vendor_products" SET "vendorCurrency" = 'USD' WHERE "vendorCurrency" = 'GBP';

-- Update gift card currencies
UPDATE "gift_cards" SET "currency" = 'USD' WHERE "currency" = 'GBP';

-- Update exchange rate base currencies
UPDATE "currency_exchange_rates" SET "baseCurrency" = 'USD' WHERE "baseCurrency" = 'GBP';

-- Alter column defaults from GBP to USD
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "users" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
ALTER TABLE "customers" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
ALTER TABLE "currency_exchange_rates" ALTER COLUMN "baseCurrency" SET DEFAULT 'USD';

-- Insert USD-based exchange rates (replace GBP-based ones)
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
