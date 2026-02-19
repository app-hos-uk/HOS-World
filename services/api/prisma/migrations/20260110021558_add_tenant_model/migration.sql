-- CreateTable: tenants
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "subdomain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_users (junction table for User-Tenant many-to-many)
CREATE TABLE IF NOT EXISTS "tenant_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: stores (placeholder for Phase 2)
CREATE TABLE IF NOT EXISTS "stores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Store',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable: configs (placeholder for Phase 4)
CREATE TABLE IF NOT EXISTS "configs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,
    "storeId" TEXT,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: tenants domain unique
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex: tenants subdomain unique
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex: tenants domain index
CREATE INDEX IF NOT EXISTS "tenants_domain_idx" ON "tenants"("domain");

-- CreateIndex: tenants subdomain index
CREATE INDEX IF NOT EXISTS "tenants_subdomain_idx" ON "tenants"("subdomain");

-- CreateIndex: tenant_users tenantId index
CREATE INDEX IF NOT EXISTS "tenant_users_tenantId_idx" ON "tenant_users"("tenantId");

-- CreateIndex: tenant_users userId index
CREATE INDEX IF NOT EXISTS "tenant_users_userId_idx" ON "tenant_users"("userId");

-- CreateIndex: tenant_users unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");

-- CreateIndex: stores tenantId index
CREATE INDEX IF NOT EXISTS "stores_tenantId_idx" ON "stores"("tenantId");

-- CreateIndex: configs level levelId index
CREATE INDEX IF NOT EXISTS "configs_level_levelId_idx" ON "configs"("level", "levelId");

-- CreateIndex: configs tenantId index
CREATE INDEX IF NOT EXISTS "configs_tenantId_idx" ON "configs"("tenantId");

-- CreateIndex: configs storeId index
CREATE INDEX IF NOT EXISTS "configs_storeId_idx" ON "configs"("storeId");

-- AddColumn: users.defaultTenantId (must be before FK)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultTenantId" TEXT;

-- AddForeignKey: tenant_users.tenantId -> tenants.id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_users_tenantId_fkey') THEN
    ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_users_userId_fkey') THEN
    ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_tenantId_fkey') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configs_tenantId_fkey') THEN
    ALTER TABLE "configs" ADD CONSTRAINT "configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configs_storeId_fkey') THEN
    ALTER TABLE "configs" ADD CONSTRAINT "configs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_defaultTenantId_fkey') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create platform tenant if it doesn't exist
INSERT INTO "tenants" ("id", "name", "subdomain", "isActive", "createdAt", "updatedAt")
VALUES ('platform', 'Platform', 'platform', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
