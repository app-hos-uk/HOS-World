# Simple Migration Fix

## Problem

You're getting a shadow database error when trying to create a migration. The database is already synced (confirmed by `db push`).

## Solution

Since the database is already synced, you have two options:

### Option 1: Create Migration File Manually (Easiest)

The migration file has been created at:
```
prisma/migrations/20260110012059_add_product_types_volume_pricing/migration.sql
```

**Now just mark it as applied:**

```bash
cd services/api
npx prisma migrate resolve --applied 20260110012059_add_product_types_volume_pricing
```

### Option 2: Use `--create-only` Flag

Create the migration without applying it:

```bash
cd services/api
npx prisma migrate dev --name add_product_types_volume_pricing --create-only
```

Then manually apply the SQL if needed (though `db push` already did this).

## Final Step: Regenerate Prisma Client

**This is the most important step!**

```bash
cd services/api
npx prisma generate
```

Or with pnpm:
```bash
cd services/api
pnpm prisma generate
```

## Verify

Check migration status:
```bash
cd services/api
npx prisma migrate status
```

Should show: `All migrations have been applied`

## Summary

1. ✅ Migration file is at: `prisma/migrations/20260110012059_add_product_types_volume_pricing/migration.sql`
2. ⚠️ Run: `npx prisma migrate resolve --applied 20260110012059_add_product_types_volume_pricing`
3. ⚠️ Run: `npx prisma generate` (IMPORTANT!)

---

**Note**: The shadow database error is happening because Prisma tries to test migrations on a shadow database. Since your database is already synced, you can safely mark the migration as applied without running it.
