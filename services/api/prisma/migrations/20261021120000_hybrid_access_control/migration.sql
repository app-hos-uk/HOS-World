-- Hybrid access control: Market entity, scoped role assignments, marketId on
-- tier-1 transactional tables (nullable). Backfill maps existing rows to the
-- default market. A later migration may set NOT NULL once counts are verified.

-- ---------------------------------------------------------------------------
-- Markets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "markets" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "taxOrigin" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "markets_code_key" ON "markets"("code");
CREATE INDEX IF NOT EXISTS "markets_isActive_idx" ON "markets"("isActive");
CREATE INDEX IF NOT EXISTS "markets_isDefault_idx" ON "markets"("isDefault");

-- Deterministic ids so backfill and seeds stay stable across environments.
INSERT INTO "markets" ("id", "code", "name", "country", "countryCode", "currency", "locale", "timezone", "isActive", "isDefault", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'US', 'United States', 'United States', 'US', 'USD', 'en-US', 'America/New_York', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'GB', 'United Kingdom', 'United Kingdom', 'GB', 'GBP', 'en-GB', 'Europe/London', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'AE', 'United Arab Emirates', 'United Arab Emirates', 'AE', 'AED', 'en-AE', 'Asia/Dubai', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'MY', 'Malaysia', 'Malaysia', 'MY', 'MYR', 'en-MY', 'Asia/Kuala_Lumpur', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Only one default market
CREATE UNIQUE INDEX IF NOT EXISTS "markets_one_default" ON "markets"("isDefault") WHERE "isDefault" = true;

-- ---------------------------------------------------------------------------
-- PermissionRole extensions
-- ---------------------------------------------------------------------------
ALTER TABLE "permission_roles" ADD COLUMN IF NOT EXISTS "scopeKind" TEXT NOT NULL DEFAULT 'ANY';
ALTER TABLE "permission_roles" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- User: home market + token version
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "homeMarketId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_homeMarketId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_homeMarketId_fkey"
      FOREIGN KEY ("homeMarketId") REFERENCES "markets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_homeMarketId_idx" ON "users"("homeMarketId");

-- ---------------------------------------------------------------------------
-- SellerMarket / ProductMarket / UserRoleAssignment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "seller_markets" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_markets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seller_markets_sellerId_marketId_key" ON "seller_markets"("sellerId", "marketId");
CREATE INDEX IF NOT EXISTS "seller_markets_marketId_idx" ON "seller_markets"("marketId");
CREATE INDEX IF NOT EXISTS "seller_markets_status_idx" ON "seller_markets"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_markets_sellerId_fkey') THEN
    ALTER TABLE "seller_markets"
      ADD CONSTRAINT "seller_markets_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_markets_marketId_fkey') THEN
    ALTER TABLE "seller_markets"
      ADD CONSTRAINT "seller_markets_marketId_fkey"
      FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "product_markets" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priceOverride" DECIMAL(10, 2),
  "currency" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_markets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_markets_productId_marketId_key" ON "product_markets"("productId", "marketId");
CREATE INDEX IF NOT EXISTS "product_markets_marketId_idx" ON "product_markets"("marketId");
CREATE INDEX IF NOT EXISTS "product_markets_isActive_idx" ON "product_markets"("isActive");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_markets_productId_fkey') THEN
    ALTER TABLE "product_markets"
      ADD CONSTRAINT "product_markets_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_markets_marketId_fkey') THEN
    ALTER TABLE "product_markets"
      ADD CONSTRAINT "product_markets_marketId_fkey"
      FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_role_assignments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionRoleId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_role_assignments_userId_idx" ON "user_role_assignments"("userId");
CREATE INDEX IF NOT EXISTS "user_role_assignments_permissionRoleId_idx" ON "user_role_assignments"("permissionRoleId");
CREATE INDEX IF NOT EXISTS "user_role_assignments_scopeType_scopeId_idx" ON "user_role_assignments"("scopeType", "scopeId");

CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_global_uniq"
  ON "user_role_assignments" ("userId", "permissionRoleId", "scopeType")
  WHERE "scopeId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_scoped_uniq"
  ON "user_role_assignments" ("userId", "permissionRoleId", "scopeType", "scopeId")
  WHERE "scopeId" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_assignments_userId_fkey') THEN
    ALTER TABLE "user_role_assignments"
      ADD CONSTRAINT "user_role_assignments_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_assignments_permissionRoleId_fkey') THEN
    ALTER TABLE "user_role_assignments"
      ADD CONSTRAINT "user_role_assignments_permissionRoleId_fkey"
      FOREIGN KEY ("permissionRoleId") REFERENCES "permission_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helper: add nullable marketId + FK + index if missing
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  tables TEXT[] := ARRAY[
    'stores',
    'orders',
    'payments',
    'transactions',
    'settlements',
    'carts',
    'gift_cards',
    'return_requests',
    'cancellation_requests',
    'disputes',
    'pos_sales',
    'store_shipment_requests',
    'vendor_ledger_entries'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'marketId'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN "marketId" TEXT', t);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_marketId_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_marketId_fkey'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = t || '_marketId_idx'
    ) THEN
      EXECUTE format('CREATE INDEX %I ON %I ("marketId")', t || '_marketId_idx', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill: resolve market from country / currency, else default
-- ---------------------------------------------------------------------------
UPDATE "stores" s
SET "marketId" = COALESCE(
  (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(COALESCE(s."countryCode", '')) LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(s."country") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(s."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE s."marketId" IS NULL;

UPDATE "orders" o
SET "marketId" = COALESCE(
  (SELECT s."marketId" FROM "stores" s
     JOIN "sellers" sel ON sel.id = o."sellerId"
     WHERE s."sellerId" = sel.id AND s."marketId" IS NOT NULL
     LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(o."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE o."marketId" IS NULL;

UPDATE "payments" p
SET "marketId" = COALESCE(
  (SELECT o."marketId" FROM "orders" o WHERE o.id = p."orderId"),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(p."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE p."marketId" IS NULL;

UPDATE "transactions" t
SET "marketId" = COALESCE(
  (SELECT o."marketId" FROM "orders" o WHERE o.id = t."orderId"),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(t."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE t."marketId" IS NULL;

UPDATE "settlements" s
SET "marketId" = COALESCE(
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(s."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE s."marketId" IS NULL;

UPDATE "carts" c
SET "marketId" = COALESCE(
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(c."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE c."marketId" IS NULL;

UPDATE "gift_cards" g
SET "marketId" = COALESCE(
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(g."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE g."marketId" IS NULL;

UPDATE "return_requests" r
SET "marketId" = COALESCE(
  (SELECT o."marketId" FROM "orders" o WHERE o.id = r."orderId"),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE r."marketId" IS NULL;

UPDATE "cancellation_requests" c
SET "marketId" = COALESCE(
  (SELECT o."marketId" FROM "orders" o WHERE o.id = c."orderId"),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE c."marketId" IS NULL;

UPDATE "disputes" d
SET "marketId" = COALESCE(
  (SELECT o."marketId" FROM "orders" o WHERE o.id = d."orderId"),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(d."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE d."marketId" IS NULL;

UPDATE "pos_sales" p
SET "marketId" = COALESCE(
  (SELECT s."marketId" FROM "stores" s WHERE s.id = p."storeId"),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(p."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE p."marketId" IS NULL;

UPDATE "store_shipment_requests" s
SET "marketId" = COALESCE(
  (SELECT st."marketId" FROM "stores" st WHERE st.id = s."storeId"),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(s."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE s."marketId" IS NULL;

UPDATE "vendor_ledger_entries" v
SET "marketId" = COALESCE(
  (SELECT o."marketId" FROM "orders" o WHERE o.id = v."orderId"),
  (SELECT m.id FROM "markets" m WHERE m."currency" = UPPER(v."currency") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE v."marketId" IS NULL;

-- Users: home market from country, else default
UPDATE "users" u
SET "homeMarketId" = COALESCE(
  (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(COALESCE(u."countryCode", '')) LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
)
WHERE u."homeMarketId" IS NULL;

-- Seller listings: map seller country to a market (plus default if different)
INSERT INTO "seller_markets" ("id", "sellerId", "marketId", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s.id,
  COALESCE(
    (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(COALESCE(s."countryCode", '')) LIMIT 1),
    (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(s."country") LIMIT 1),
    (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
  ),
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "sellers" s
WHERE NOT EXISTS (
  SELECT 1 FROM "seller_markets" sm WHERE sm."sellerId" = s.id
)
AND COALESCE(
  (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(COALESCE(s."countryCode", '')) LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."code" = UPPER(s."country") LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
) IS NOT NULL;

-- Product listings: inherit seller's first market, else default
INSERT INTO "product_markets" ("id", "productId", "marketId", "isActive", "currency", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p.id,
  COALESCE(
    (SELECT sm."marketId" FROM "seller_markets" sm WHERE sm."sellerId" = p."sellerId" LIMIT 1),
    (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
  ),
  true,
  p."currency",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "products" p
WHERE NOT EXISTS (
  SELECT 1 FROM "product_markets" pm WHERE pm."productId" = p.id
)
AND COALESCE(
  (SELECT sm."marketId" FROM "seller_markets" sm WHERE sm."sellerId" = p."sellerId" LIMIT 1),
  (SELECT m.id FROM "markets" m WHERE m."isDefault" = true LIMIT 1)
) IS NOT NULL;

-- System permission roles (seed-on-migrate, upsert)
INSERT INTO "permission_roles" ("id", "name", "permissions", "scopeKind", "isSystem", "createdAt", "updatedAt")
VALUES
  ('pr-admin', 'ADMIN', '["*"]'::jsonb, 'ANY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "isSystem" = true, "scopeKind" = COALESCE("permission_roles"."scopeKind", 'ANY');

-- Unrestricted ADMIN users get a GLOBAL assignment so day-one behaviour is
-- unchanged. Admins carrying a permissionRoleId are deliberately excluded:
-- PermissionsGuard treats them as narrowed rather than super-admin, and a
-- GLOBAL assignment here would silently escalate them to '*' under enforce.
-- Their access continues to derive from that permission role.
INSERT INTO "user_role_assignments" ("id", "userId", "permissionRoleId", "scopeType", "scopeId", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  pr.id,
  'GLOBAL',
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
JOIN "permission_roles" pr ON pr."name" = 'ADMIN'
WHERE u."role" = 'ADMIN'
  AND u."permissionRoleId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_role_assignments" a
    WHERE a."userId" = u.id AND a."permissionRoleId" = pr.id AND a."scopeType" = 'GLOBAL'
  );
