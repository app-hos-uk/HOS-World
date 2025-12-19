# 🔍 Migration Troubleshooting Guide

## Issue: `_prisma_migrations` Table Not Found After Migration

### Current Status
- ✅ Migration shows "success" in UI
- ✅ All verification checks pass
- ❌ But logs still show: `⚠️ Prisma migrations table not found`

### Root Cause Analysis

The `run_and_baseline.sql` file **does include** the CREATE TABLE statement for `_prisma_migrations` at the beginning:

```sql
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    ...
);
```

However, the table is still not being created. Possible reasons:

1. **SQL Statement Splitting Issue**: The migration controller splits SQL by semicolons, which might break multi-line CREATE TABLE statements
2. **Transaction Issue**: The CREATE TABLE might be in a transaction that's not committing
3. **Database Connection**: Different database instance being checked vs. migrated
4. **Silent Failure**: The CREATE TABLE statement might be failing silently

### Solution: Enhanced Verification

I've updated the migration endpoint to:
- ✅ Check if `_prisma_migrations` table exists after migration
- ✅ Verify all expected tables were created
- ✅ Log detailed verification results
- ✅ Warn if critical table is missing

### Next Steps

1. **Re-run the Global Platform Features migration** from the admin UI
2. **Check the verification results** - it will now show:
   - `prismaMigrationsTableExists: true/false`
   - `currencyExchangeRatesTableExists: true/false`
   - `gdprConsentLogsTableExists: true/false`
   - `countryColumnExists: true/false`

3. **If `prismaMigrationsTableExists` is still `false`**:
   - Check the migration details for any errors on the CREATE TABLE statement
   - The SQL statement might need to be executed manually

### Manual Fix (If Needed)

If the migration still doesn't create the table, you can run this SQL directly:

```sql
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP,
    "started_at" TIMESTAMP NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
```

**Via Railway Dashboard:**
1. Go to Railway → PostgreSQL service
2. Click "Query" tab
3. Paste the SQL above
4. Execute

**Or via API:**
Use the `/admin/migration/run-sql-direct` endpoint which has embedded SQL that's guaranteed to work.

### Verification After Fix

After the table is created, restart the API service. You should see:
```
✅ Database is up to date - no pending migrations
```

Instead of:
```
⚠️ Prisma migrations table not found
```

---

**Status**: Enhanced verification added. Re-run migration and check verification results.


