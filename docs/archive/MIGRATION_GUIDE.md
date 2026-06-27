# Migration Guide - Stock Transfer and Movement Models

## Problem
When running `prisma migrate dev`, you may encounter:
```
Error: P3006
Migration `20251206133014_add_global_features` failed to apply cleanly to the shadow database.
Error: The underlying table for model `users` does not exist.
```

This happens because Prisma uses a shadow database to validate migrations, and the shadow database doesn't have the existing schema.

## Solution Options

### Option 1: Use `prisma db push` (Recommended for Development) ⚡

This directly syncs your Prisma schema to the database without creating migration files. It's faster and doesn't require shadow database setup.

```bash
cd services/api
pnpm db:push
```

**Pros:**
- ✅ Fast and simple
- ✅ No shadow database needed
- ✅ Perfect for development
- ✅ Automatically handles schema changes

**Cons:**
- ⚠️ Doesn't create migration history (not ideal for production)
- ⚠️ Can't rollback easily

**Use this when:**
- Working in development
- Schema changes are still evolving
- You want quick iteration

---

### Option 2: Apply SQL Migration Directly (Recommended for Production) 🔒

If you need proper migration history, apply the SQL directly:

```bash
cd services/api

# Option 2a: Using psql
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql

# Option 2b: Using Railway CLI
railway run psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql

# Option 2c: Using Prisma Studio's SQL editor
pnpm db:studio
# Then copy/paste the SQL from add_stock_transfer_and_movement.sql
```

**Then mark the migration as applied:**

```bash
# Create a migration folder manually
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_stock_transfer_and_movement

# Copy the SQL file
cp prisma/migrations/add_stock_transfer_and_movement.sql prisma/migrations/$(date +%Y%m%d%H%M%S)_add_stock_transfer_and_movement/migration.sql

# Mark as applied (this tells Prisma the migration was already run)
pnpm prisma migrate resolve --applied $(ls -t prisma/migrations | head -1 | cut -d'_' -f1-2)
```

**Pros:**
- ✅ Proper migration history
- ✅ Can track changes over time
- ✅ Works with production deployments
- ✅ Can rollback if needed

**Cons:**
- ⚠️ More manual steps
- ⚠️ Need to manage SQL manually

**Use this when:**
- Deploying to production
- You need audit trail of changes
- Working with a team

---

### Option 3: Fix Shadow Database (Advanced) 🔧

If you need to use `prisma migrate dev` properly, set up a shadow database:

1. **Create a shadow database** (separate from main DB):
   ```bash
   # In your .env file, add:
   SHADOW_DATABASE_URL="postgresql://user:password@host:port/shadow_db_name"
   ```

2. **Update schema.prisma**:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
   }
   ```

3. **Run migration**:
   ```bash
   pnpm db:migrate
   ```

**Pros:**
- ✅ Full Prisma migration workflow
- ✅ Proper validation

**Cons:**
- ⚠️ Requires additional database setup
- ⚠️ More complex configuration
- ⚠️ Usually not needed for most use cases

**Use this when:**
- You need strict migration validation
- Working with complex migration workflows
- Company policy requires it

---

### Option 4: Skip Shadow Database Validation (Quick Fix) ⚡

If you just want to create the migration file without validation:

```bash
cd services/api

# Create migration without applying (creates the file only)
pnpm prisma migrate dev --create-only --name add_stock_transfer_and_movement

# Then apply manually using Option 2 above
```

**Pros:**
- ✅ Creates proper migration file
- ✅ No shadow database needed

**Cons:**
- ⚠️ Still need to apply manually

---

## Recommended Approach

### For Development:
```bash
cd services/api
pnpm db:push
pnpm db:generate
```

### For Production/Staging:
```bash
cd services/api

# Apply SQL directly
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql

# Generate Prisma client
pnpm db:generate

# Verify schema matches
pnpm prisma db pull  # This will show any differences
```

---

## After Migration

Regardless of which option you choose, after the migration:

1. **Generate Prisma Client:**
   ```bash
   cd services/api
   pnpm db:generate
   ```

2. **Verify the migration:**
   ```bash
   # Check that tables were created
   pnpm db:studio
   # Or use psql:
   psql $DATABASE_URL -c "\dt stock_*"
   ```

3. **Test the application:**
   ```bash
   pnpm build
   pnpm start:dev
   ```

---

## Troubleshooting

### Error: "relation already exists"
The tables might already exist. Check with:
```bash
psql $DATABASE_URL -c "\dt stock_*"
```

If they exist, you can skip the migration or drop and recreate:
```bash
# CAREFUL: This deletes data!
psql $DATABASE_URL -c "DROP TABLE IF EXISTS stock_movements CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS stock_transfers CASCADE;"
# Then re-run migration
```

### Error: "foreign key constraint violation"
Make sure `warehouses`, `inventory_locations`, and `products` tables exist first. Run existing migrations:
```bash
pnpm db:migrate:deploy
```

### Error: "type already exists"
The enums might already exist. The SQL uses `CREATE TYPE IF NOT EXISTS` but PostgreSQL doesn't support that. The SQL uses `DO $$ BEGIN ... EXCEPTION ... END $$;` blocks to handle this safely.

---

## Verification

After migration, verify everything works:

```bash
# 1. Check tables exist
psql $DATABASE_URL -c "\dt stock_*"

# 2. Check enums exist
psql $DATABASE_URL -c "\dT+ TransferStatus"
psql $DATABASE_URL -c "\dT+ MovementType"

# 3. Check indexes
psql $DATABASE_URL -c "\di stock_*"

# 4. Test Prisma client
cd services/api
pnpm db:generate
pnpm build
```

---

## Need Help?

If you continue to have issues:
1. Check your `DATABASE_URL` is correct
2. Verify database permissions
3. Check Prisma version: `pnpm prisma --version`
4. Review Prisma logs for detailed errors
