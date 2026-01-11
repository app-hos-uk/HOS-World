# Apply All Phase 3 Migrations

## Phase 3 Features Requiring Database Migrations

Phase 3 includes these features that need database migrations:

1. ✅ **Stock Transfer & Movement** - Already applied!
2. ⏳ **Tax Zones, Classes, and Rates** - Need to apply
3. ✅ **Faceted Search** - No migration needed (Elasticsearch only)

---

## Migration 1: Stock Transfer & Movement ✅ COMPLETED

Already applied successfully! Tables created:
- `stock_transfers`
- `stock_movements`

**Status**: ✅ Done

---

## Migration 2: Tax Zones, Classes, and Rates ⏳ NEEDS APPLICATION

This migration creates:
- `tax_zones` - Tax zones for location-based tax calculation
- `tax_classes` - Tax classes (Standard, Reduced, Zero, etc.)
- `tax_rates` - Tax rates linking zones to classes
- Adds `taxClassId` column to `products` table

### Apply Tax Zones Migration

Run this command in your terminal:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -f prisma/migrations/add_tax_zones_and_classes.sql
```

### Verify Tax Tables

After running, verify:

```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dt tax_*"
```

**Expected output:**
```
               List of relations
 Schema |    Name     | Type  |  Owner   
--------+-------------+-------+----------
 public | tax_classes | table | postgres
 public | tax_rates   | table | postgres
 public | tax_zones   | table | postgres
```

### Verify Products Table Updated

```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\d products" | grep taxClassId
```

Should show:
```
 taxClassId | text | 
```

---

## Complete Phase 3 Migration Workflow

Run all migrations in order:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# Migration 1: Stock Transfer & Movement (already done, but safe to run again)
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -f prisma/migrations/add_stock_transfer_and_movement.sql

# Migration 2: Tax Zones, Classes, and Rates
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -f prisma/migrations/add_tax_zones_and_classes.sql

# Verify all tables exist
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dt stock_*"
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dt tax_*"

# Regenerate Prisma client
pnpm db:generate

# Build the API
pnpm build
```

---

## Verification Checklist

After applying all migrations, verify:

- [ ] `stock_transfers` table exists
- [ ] `stock_movements` table exists
- [ ] `tax_zones` table exists
- [ ] `tax_classes` table exists
- [ ] `tax_rates` table exists
- [ ] `products.taxClassId` column exists
- [ ] All foreign keys created
- [ ] All indexes created
- [ ] Prisma client regenerated
- [ ] API builds successfully

---

## What Each Migration Does

### Stock Transfer & Movement Migration
- Creates `stock_transfers` table for warehouse-to-warehouse transfers
- Creates `stock_movements` table for inventory audit trail
- Creates `TransferStatus` and `MovementType` enums
- Adds foreign keys to warehouses, products, and inventory_locations

### Tax Zones Migration
- Creates `tax_zones` table for location-based tax zones
- Creates `tax_classes` table for tax categories (Standard, Reduced, Zero)
- Creates `tax_rates` table linking zones to classes with rates
- Adds `taxClassId` column to `products` table
- Enables location-based tax calculation in cart and orders

---

## Troubleshooting

### If tables already exist
All migrations use `IF NOT EXISTS`, so they're safe to run multiple times. You'll see "already exists" notices, which is fine.

### If foreign key errors occur
Make sure these tables exist first:
- `warehouses` (for stock transfers)
- `products` (for stock transfers and tax classes)
- `inventory_locations` (for stock movements)

### If migration fails partway
Each migration is idempotent (safe to re-run). Just run the command again.

---

**Next Step**: Apply the tax zones migration to complete Phase 3 database setup.
