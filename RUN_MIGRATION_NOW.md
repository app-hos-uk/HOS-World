# Run Migration - Exact Command

## Apply the Migration

Run this command in your terminal:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -f prisma/migrations/add_stock_transfer_and_movement.sql
```

---

## Verify Tables Were Created

After running the migration, verify:

```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dt stock_*"
```

**Expected output:**
```
               List of relations
 Schema |       Name        | Type  |  Owner
--------+-------------------+-------+--------
 public | stock_movements   | table | postgres
 public | stock_transfers   | table | postgres
```

---

## Verify Enums

```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dT+ TransferStatus"
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dT+ MovementType"
```

---

## After Migration - Complete Setup

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# 1. Regenerate Prisma client (if needed)
pnpm db:generate

# 2. Build the API
pnpm build

# 3. Test the endpoints (optional)
pnpm start:dev
```

---

## All Commands in One Go

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# Apply migration
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -f prisma/migrations/add_stock_transfer_and_movement.sql

# Verify
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dt stock_*"

# Regenerate Prisma client
pnpm db:generate
```

---

## Troubleshooting

### If "psql: command not found"
Install PostgreSQL client:
```bash
brew install postgresql
```

### If connection times out
Make sure:
1. Your IP is allowed in Railway (check Railway dashboard → PostgreSQL → Settings)
2. You're using the public proxy URL (which you are)
3. The database service is running

### If "relation already exists"
The tables might already exist. Check first:
```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "\dt stock_*"
```

If they exist, you're done! The migration uses `IF NOT EXISTS` so it's safe to run again.
