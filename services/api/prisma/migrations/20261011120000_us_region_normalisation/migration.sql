-- US / USD region normalisation (label change only — no FX conversion of amounts).
--
-- Repairs silent half-success of 20260219100000_convert_gbp_to_usd and re-introduced
-- GBP / GB / Europe/London defaults from later feature migrations.
--
-- Guarding: each step checks information_schema before touching a column.
-- Failures are NOT swallowed (no EXCEPTION WHEN OTHERS). A verification block at the
-- end RAISE EXCEPTION if any residual UK/GBP values remain on touched columns.

-- ---------------------------------------------------------------------------
-- Helpers pattern: SET DEFAULT + UPDATE rows when the column exists.
-- ---------------------------------------------------------------------------

-- Currency columns: DEFAULT 'USD' + relabel remaining 'GBP' -> 'USD'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "products" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "orders" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "payments" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "transactions" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'currencyPreference'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
    UPDATE "users" SET "currencyPreference" = 'USD' WHERE "currencyPreference" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'carts' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "carts" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'currencyPreference'
  ) THEN
    ALTER TABLE "customers" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
    UPDATE "customers" SET "currencyPreference" = 'USD' WHERE "currencyPreference" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_products' AND column_name = 'vendorCurrency'
  ) THEN
    ALTER TABLE "vendor_products" ALTER COLUMN "vendorCurrency" SET DEFAULT 'USD';
    UPDATE "vendor_products" SET "vendorCurrency" = 'USD' WHERE "vendorCurrency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_ledger_entries' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "vendor_ledger_entries" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "vendor_ledger_entries" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gift_cards' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "gift_cards" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "gift_cards" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settlements' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "settlements" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'currency_exchange_rates' AND column_name = 'baseCurrency'
  ) THEN
    ALTER TABLE "currency_exchange_rates" ALTER COLUMN "baseCurrency" SET DEFAULT 'USD';
    UPDATE "currency_exchange_rates" SET "baseCurrency" = 'USD' WHERE "baseCurrency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencer_commissions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "influencer_commissions" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "influencer_commissions" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencer_payouts' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "influencer_payouts" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "influencer_payouts" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "disputes" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "disputes" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

-- Post-Feb feature tables that re-introduced DEFAULT 'GBP'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "stores" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "stores" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_memberships' AND column_name = 'preferredCurrency'
  ) THEN
    ALTER TABLE "loyalty_memberships" ALTER COLUMN "preferredCurrency" SET DEFAULT 'USD';
    UPDATE "loyalty_memberships" SET "preferredCurrency" = 'USD' WHERE "preferredCurrency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pos_sales' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "pos_sales" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "pos_sales" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'ticketCurrency'
  ) THEN
    ALTER TABLE "events" ALTER COLUMN "ticketCurrency" SET DEFAULT 'USD';
    UPDATE "events" SET "ticketCurrency" = 'USD' WHERE "ticketCurrency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brand_partnerships' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "brand_partnerships" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "brand_partnerships" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_pos_vouchers' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "loyalty_pos_vouchers" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "loyalty_pos_vouchers" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

-- Currency columns without a Prisma default (data-only relabel)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_channels' AND column_name = 'currency'
  ) THEN
    UPDATE "product_channels" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reconciliation_items' AND column_name = 'currency'
  ) THEN
    UPDATE "reconciliation_items" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Region / country / timezone (UK -> US labels)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'country'
  ) THEN
    ALTER TABLE "stores" ALTER COLUMN "country" SET DEFAULT 'US';
    UPDATE "stores" SET "country" = 'US' WHERE "country" = 'GB';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE "stores" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';
    UPDATE "stores" SET "timezone" = 'America/New_York' WHERE "timezone" = 'Europe/London';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'defaultRegionCode'
  ) THEN
    ALTER TABLE "stores" ALTER COLUMN "defaultRegionCode" SET DEFAULT 'US';
    UPDATE "stores" SET "defaultRegionCode" = 'US' WHERE "defaultRegionCode" = 'GB';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_memberships' AND column_name = 'regionCode'
  ) THEN
    ALTER TABLE "loyalty_memberships" ALTER COLUMN "regionCode" SET DEFAULT 'US';
    UPDATE "loyalty_memberships" SET "regionCode" = 'US' WHERE "regionCode" = 'GB';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE "events" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';
    UPDATE "events" SET "timezone" = 'America/New_York' WHERE "timezone" = 'Europe/London';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Platform region overrides in the Config table.
-- PlatformRegionService reads these ahead of env defaults, so a residual UK row
-- here would keep serving GBP/GB from /config/region after the data is relabelled.
-- 'currency' is the legacy key written by admin settings; 'platformCurrency' is current.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'configs'
  ) THEN
    UPDATE "configs" SET "value" = '"USD"'::jsonb
    WHERE "level" = 'PLATFORM'
      AND "key" IN ('currency', 'platformCurrency')
      AND "value" #>> '{}' = 'GBP';

    UPDATE "configs" SET "value" = '"US"'::jsonb
    WHERE "level" = 'PLATFORM'
      AND "key" = 'platformCountry'
      AND "value" #>> '{}' = 'GB';

    UPDATE "configs" SET "value" = '"en-US"'::jsonb
    WHERE "level" = 'PLATFORM'
      AND "key" = 'platformLocale'
      AND "value" #>> '{}' = 'en-GB';

    UPDATE "configs" SET "value" = '"America/New_York"'::jsonb
    WHERE "level" = 'PLATFORM'
      AND "key" = 'platformTimezone'
      AND "value" #>> '{}' = 'Europe/London';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verification: fail the migration if any residual UK/GBP values remain.
-- Note: currency_exchange_rates.targetCurrency may legitimately be 'GBP' (FX pair).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  remaining BIGINT := 0;
  n BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "products" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "orders" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "payments" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "transactions" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'currencyPreference'
  ) THEN
    SELECT COUNT(*) INTO n FROM "users" WHERE "currencyPreference" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'carts' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "carts" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'currencyPreference'
  ) THEN
    SELECT COUNT(*) INTO n FROM "customers" WHERE "currencyPreference" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_products' AND column_name = 'vendorCurrency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "vendor_products" WHERE "vendorCurrency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_ledger_entries' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "vendor_ledger_entries" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gift_cards' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "gift_cards" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settlements' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "settlements" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'currency_exchange_rates' AND column_name = 'baseCurrency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "currency_exchange_rates" WHERE "baseCurrency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencer_commissions' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "influencer_commissions" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencer_payouts' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "influencer_payouts" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "disputes" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "stores" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_memberships' AND column_name = 'preferredCurrency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "loyalty_memberships" WHERE "preferredCurrency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pos_sales' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "pos_sales" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'ticketCurrency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "events" WHERE "ticketCurrency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brand_partnerships' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "brand_partnerships" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_pos_vouchers' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "loyalty_pos_vouchers" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_channels' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "product_channels" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reconciliation_items' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO n FROM "reconciliation_items" WHERE "currency" = 'GBP';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'country'
  ) THEN
    SELECT COUNT(*) INTO n FROM "stores" WHERE "country" = 'GB';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'timezone'
  ) THEN
    SELECT COUNT(*) INTO n FROM "stores" WHERE "timezone" = 'Europe/London';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'defaultRegionCode'
  ) THEN
    SELECT COUNT(*) INTO n FROM "stores" WHERE "defaultRegionCode" = 'GB';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loyalty_memberships' AND column_name = 'regionCode'
  ) THEN
    SELECT COUNT(*) INTO n FROM "loyalty_memberships" WHERE "regionCode" = 'GB';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'timezone'
  ) THEN
    SELECT COUNT(*) INTO n FROM "events" WHERE "timezone" = 'Europe/London';
    remaining := remaining + n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'configs'
  ) THEN
    SELECT COUNT(*) INTO n FROM "configs"
    WHERE "level" = 'PLATFORM'
      AND (
        ("key" IN ('currency', 'platformCurrency') AND "value" #>> '{}' = 'GBP')
        OR ("key" = 'platformCountry' AND "value" #>> '{}' = 'GB')
        OR ("key" = 'platformLocale' AND "value" #>> '{}' = 'en-GB')
        OR ("key" = 'platformTimezone' AND "value" #>> '{}' = 'Europe/London')
      );
    remaining := remaining + n;
  END IF;

  IF remaining > 0 THEN
    RAISE EXCEPTION
      'US region normalisation incomplete: % residual GBP/GB/Europe/London value(s) remain on touched columns',
      remaining;
  END IF;
END $$;
