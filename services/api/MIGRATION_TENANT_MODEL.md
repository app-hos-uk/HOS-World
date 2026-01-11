# Migration Guide: Tenant Model (Phase 1)

## Status
✅ Migration SQL file created: `prisma/migrations/20260110021558_add_tenant_model/migration.sql`

## Steps to Apply Migration

### Option 1: Use Prisma Migrate (Recommended for Production)

1. **Mark migration as applied** (if database already has the changes from `db push`):
   ```bash
   cd services/api
   pnpm prisma migrate resolve --applied 20260110021558_add_tenant_model
   ```

2. **Or apply the migration directly**:
   ```bash
   cd services/api
   pnpm prisma migrate deploy
   ```

### Option 2: Apply SQL Manually (If migrate deploy fails)

1. **Connect to your database**:
   ```bash
   # Using psql
   psql $DATABASE_URL
   
   # Or using Railway CLI
   railway connect postgres
   ```

2. **Run the migration SQL**:
   ```sql
   -- Copy and paste contents from:
   -- prisma/migrations/20260110021558_add_tenant_model/migration.sql
   ```

3. **Mark as applied**:
   ```bash
   cd services/api
   pnpm prisma migrate resolve --applied 20260110021558_add_tenant_model
   ```

### Option 3: Use db push (Quick sync, not recommended for production)

If you just want to sync the schema without creating a migration:
```bash
cd services/api
pnpm prisma db push
```

**Note**: This won't create a migration record, so use `migrate resolve` if you want to track it.

## What This Migration Creates

1. **`tenants` table**: Top-level organization model
   - Fields: id, name, domain, subdomain, isActive, config, metadata
   - Indexes: domain, subdomain (unique), domain_idx, subdomain_idx

2. **`tenant_users` table**: Junction table for User-Tenant membership
   - Fields: id, tenantId, userId, role, isActive, joinedAt
   - Foreign keys: tenantId → tenants.id, userId → users.id
   - Unique constraint: (tenantId, userId)

3. **`stores` table**: Placeholder for Phase 2
   - Fields: id, tenantId, name, createdAt, updatedAt
   - Foreign key: tenantId → tenants.id

4. **`configs` table**: Placeholder for Phase 4
   - Fields: id, level, levelId, key, value, tenantId, storeId
   - Foreign keys: tenantId → tenants.id, storeId → stores.id

5. **Updates `users` table**:
   - Adds `defaultTenantId` column
   - Foreign key: defaultTenantId → tenants.id

6. **Creates platform tenant**:
   - Auto-creates a default "Platform" tenant with id='platform'

## Verification

After applying the migration, verify it worked:

```bash
cd services/api
pnpm prisma migrate status
```

You should see:
```
8 migrations found in prisma/migrations

Database schema is up to date!
```

## Troubleshooting

### Error: "Table already exists"
If tables already exist (from previous `db push`), the migration will use `IF NOT EXISTS` clauses, so it should be safe to run. If you get errors, you can:
1. Check which tables already exist
2. Skip creation of existing tables
3. Mark migration as applied

### Error: "Foreign key constraint fails"
Make sure:
- The `users` table exists (it should from previous migrations)
- All referenced tables are created in the correct order

### Error: Shadow database issue
If `prisma migrate dev` fails with shadow database errors, use:
- `prisma migrate deploy` (production)
- `prisma db push` + `migrate resolve` (development)

## Next Steps

After migration is applied:

1. **Generate Prisma Client**:
   ```bash
   pnpm prisma generate
   ```

2. **Test the API**:
   ```bash
   # Start the API server
   pnpm start:dev
   
   # Test tenant creation (requires admin token)
   curl -X POST http://localhost:3001/api/v1/tenants \
     -H "Authorization: Bearer <admin_token>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Tenant","subdomain":"test"}'
   ```

3. **Verify new user registration**:
   - Register a new user
   - Check that tenant membership is automatically created
   - Verify defaultTenantId is set

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Drop foreign keys first
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_defaultTenantId_fkey";
ALTER TABLE "configs" DROP CONSTRAINT IF EXISTS "configs_storeId_fkey";
ALTER TABLE "configs" DROP CONSTRAINT IF EXISTS "configs_tenantId_fkey";
ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "stores_tenantId_fkey";
ALTER TABLE "tenant_users" DROP CONSTRAINT IF EXISTS "tenant_users_userId_fkey";
ALTER TABLE "tenant_users" DROP CONSTRAINT IF EXISTS "tenant_users_tenantId_fkey";

-- Drop columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "defaultTenantId";

-- Drop tables
DROP TABLE IF EXISTS "configs";
DROP TABLE IF EXISTS "stores";
DROP TABLE IF EXISTS "tenant_users";
DROP TABLE IF EXISTS "tenants";
```

Then mark migration as rolled back:
```bash
pnpm prisma migrate resolve --rolled-back 20260110021558_add_tenant_model
```
