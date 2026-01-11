# Fix Duplicate Migrations

## Problem

There are 3 duplicate migration directories for the same migration:
1. `20250108180000_add_product_types_volume_pricing` - Empty (no migration.sql)
2. `20260110012050_add_product_types_volume_pricing` - Has migration.sql
3. `20260110012059_add_product_types_volume_pricing` - Has migration.sql (already marked as applied)

## Solution

Since the database is already synced, mark the other duplicate as applied and remove the empty one:

### Step 1: Mark the other duplicate as applied

```bash
cd services/api
pnpm prisma migrate resolve --applied 20260110012050_add_product_types_volume_pricing
```

### Step 2: Remove the empty duplicate migration directory

```bash
cd services/api
rm -rf prisma/migrations/20250108180000_add_product_types_volume_pricing
```

### Step 3: Verify

```bash
cd services/api
pnpm prisma migrate status
```

Should show: "All migrations have been applied"

## Alternative: Keep Only One Migration

If you prefer to keep only one migration file, you can:

1. Delete the duplicate migration directories:
```bash
cd services/api
rm -rf prisma/migrations/20250108180000_add_product_types_volume_pricing
rm -rf prisma/migrations/20260110012050_add_product_types_volume_pricing
```

2. Keep only: `20260110012059_add_product_types_volume_pricing` (already marked as applied)

3. Verify:
```bash
pnpm prisma migrate status
```

---

**Choose the solution that works best for you!**
