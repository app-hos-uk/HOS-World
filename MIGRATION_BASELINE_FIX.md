# Migration Baseline Fix

## Problem
The migration failed because Prisma doesn't have a migration history table (`_prisma_migrations`) in the database. This happens when the database was created with `prisma db push` or manually.

**Error:** `P3005: The database schema is not empty`

## Solution Options

### Option 1: Baseline the Migration (Recommended)

Tell Prisma that the current database state matches the migration state, then it will track future migrations.

**Steps:**
1. Go to Railway Dashboard → PostgreSQL service
2. Run this SQL to create the migration history table and mark the migration as applied:

```sql
-- Create Prisma migrations table
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

-- Mark the migration as already applied (baseline)
-- Get the migration name from: 20251206133014_add_global_features
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '', -- Prisma will update this
    NOW(),
    '20251206133014_add_global_features',
    NOW(),
    1
) ON CONFLICT DO NOTHING;
```

3. Then run the actual migration SQL (from `add_global_features.sql`) to add the new columns and tables.

### Option 2: Run Migration SQL Directly (Easier)

Since we have the SQL file, just run it directly:

1. Go to Railway Dashboard → PostgreSQL service
2. Go to "Data" or "Query" tab
3. Copy and paste the entire contents of: `services/api/prisma/migrations/add_global_features.sql`
4. Execute the SQL
5. Then baseline the migration (Option 1, step 2) so Prisma knows it's applied

### Option 3: Update PrismaService to Handle This

We can update the PrismaService to check if migrations table exists, and if not, create it and baseline.

---

## Recommended Approach: Option 2 + Baseline

1. **Run the SQL directly** (easiest, gets the changes applied immediately)
2. **Baseline the migration** (so Prisma knows it's done and can track future migrations)

---

## After Fixing

Once you've run the SQL and baselined:
- The migration will be marked as applied
- Future migrations will work normally
- PrismaService will see "no pending migrations" and continue

---

## Quick Fix SQL

Run this in Railway PostgreSQL service to baseline:

```sql
-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP,
    "started_at" TIMESTAMP NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Mark migration as applied
INSERT INTO "_prisma_migrations" (
    "id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '',
    NOW(),
    '20251206133014_add_global_features',
    NOW(),
    1
) ON CONFLICT DO NOTHING;
```

Then run the actual migration SQL from `add_global_features.sql`.

