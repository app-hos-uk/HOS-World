# Apply Stock Transfer & Movement Migration

## Problem
Prisma says "database is already in sync" but tables don't exist. This happens when Prisma's internal state is out of sync.

## Solution: Apply SQL Migration Directly

Since `db:push` isn't detecting the changes, apply the SQL migration directly:

### Step 1: Apply the SQL Migration

Run this command in your terminal:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
```

**If using Railway CLI:**
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
railway run psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
```

### Step 2: Verify Tables Were Created

```bash
psql $DATABASE_URL -c "\dt stock_*"
```

You should see:
- `stock_movements`
- `stock_transfers`

### Step 3: Verify Enums

```bash
psql $DATABASE_URL -c "\dT+ TransferStatus"
psql $DATABASE_URL -c "\dT+ MovementType"
```

### Step 4: Reset Prisma's Internal State

After applying SQL, reset Prisma's migration state:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# Option 1: Force Prisma to recognize the changes
pnpm prisma db pull
pnpm prisma db push --accept-data-loss

# Option 2: Mark migration as applied (if using migrations)
pnpm prisma migrate resolve --applied 20250106_add_stock_transfer_and_movement
```

---

## Alternative: Force Prisma to Re-sync

If SQL doesn't work, force Prisma to recreate everything:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# 1. Pull current database state
pnpm prisma db pull

# 2. This will create a new schema.prisma with current state
# 3. Compare and merge manually if needed

# 4. Then push again
pnpm prisma db push --force-reset --skip-seed
```

⚠️ **Warning**: `--force-reset` will drop all data! Only use if you have a backup.

---

## Quick Check: Verify Schema vs Database

Check what Prisma thinks exists:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm prisma db pull --print
```

This will show you the current database state as Prisma sees it.

---

## Most Likely Solution

Since the models are in the schema but tables don't exist, the SQL migration approach is safest:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
pnpm db:generate
```

Then verify with:
```bash
psql $DATABASE_URL -c "\dt stock_*"
```
