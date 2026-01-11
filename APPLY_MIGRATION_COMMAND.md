# Apply Migration - Exact Commands

## Apply the SQL Migration

Run this command in your terminal:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -f prisma/migrations/add_stock_transfer_and_movement.sql
```

---

## Verify Tables Were Created

After running the migration, verify the tables exist:

```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\dt stock_*"
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

## Verify Enums Were Created

```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\dT+ TransferStatus"
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\dT+ MovementType"
```

---

## Check Table Structure

```bash
# Check stock_transfers table
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\d stock_transfers"

# Check stock_movements table
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\d stock_movements"
```

---

## After Migration - Regenerate Prisma Client

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm db:generate
```

---

## Complete Workflow (All Steps)

```bash
# 1. Navigate to API directory
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# 2. Apply the migration
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -f prisma/migrations/add_stock_transfer_and_movement.sql

# 3. Verify tables exist
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\dt stock_*"

# 4. Regenerate Prisma client
pnpm db:generate

# 5. Build the API
pnpm build
```

---

## If Command Fails

### Error: "psql: command not found"
Install PostgreSQL client:
```bash
# macOS
brew install postgresql

# Or use Docker
docker run -it --rm postgres psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -f /path/to/add_stock_transfer_and_movement.sql
```

### Error: "connection refused"
Note: `postgres.railway.internal` is for **internal Railway services only**. 

If you're running from your local machine, you need the **public Railway URL** instead:

```bash
# Check your .env file for the correct DATABASE_URL
# It should be something like:
# DATABASE_URL="postgresql://postgres:password@gondola.proxy.rlwy.net:15729/railway"

# Then use that URL instead
```

### Error: "relation already exists"
The tables might already exist. Check first:
```bash
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" -c "\dt stock_*"
```

If they exist, you're good! The migration uses `IF NOT EXISTS` so it's safe to run again.

---

## Important Note

⚠️ The URL `postgres.railway.internal:5432` is for **internal Railway network connections only**. 

If you're connecting from your local machine, you'll need to use the public Railway proxy URL instead. Check your `.env` file for the correct `DATABASE_URL` - it should look like:
```
postgresql://postgres:password@gondola.proxy.rlwy.net:15729/railway
```

If the internal URL doesn't work from your local machine, use the public proxy URL from your `.env` file.
