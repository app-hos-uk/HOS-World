# Migration History Fix

This guide fixes the Prisma migration history when `20251206133014_add_global_features` is in a **failed** state (e.g. `finished_at` is NULL in `_prisma_migrations`) or when you get a **checksum mismatch** after baselining manually. After applying this fix, `prisma migrate deploy` will run successfully.

## Why it breaks

- **Failed state:** The migration was started (row inserted with `finished_at` NULL) but never completed (e.g. shadow DB issue, connection drop). Prisma then refuses to run new migrations until the failed one is resolved.
- **Wrong checksum:** If you ran `run_and_baseline.sql` or inserted into `_prisma_migrations` by hand with an empty/wrong `checksum`, Prisma will report a checksum mismatch on the next deploy.

## Fix: clear the bad record and re-apply

The migration SQL is **idempotent** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), so it is safe to remove the migration record and let Prisma apply it again.

### Step 1: Remove the failed or invalid record

From the repo root:

```bash
cd services/api
pnpm prisma db execute --file scripts/fix-migration-history.sql
```

Or run this SQL directly against your database:

```sql
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20251206133014_add_global_features';
```

### Step 2: Deploy migrations

```bash
pnpm db:migrate:deploy
```

Prisma will apply `20251206133014_add_global_features` (and any later pending migrations). The migration will no-op for objects that already exist.

### Step 3: Regenerate client (if needed)

```bash
pnpm db:generate
```

## Alternative: migration already applied manually

If you **know** the schema from `20251206133014_add_global_features` is already in the database (e.g. you ran `run_and_baseline.sql` or `db push`), you can skip re-running the SQL and only fix the history:

```bash
cd services/api
pnpm prisma migrate resolve --applied 20251206133014_add_global_features
pnpm db:migrate:deploy
```

This marks the migration as applied with the correct checksum, then runs any remaining pending migrations.

## Verify

```bash
pnpm prisma migrate status
```

You should see **no pending migrations** and no failed migration for `20251206133014_add_global_features`.
