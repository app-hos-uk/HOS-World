# Run Migration Using Railway CLI

Since the public network connection timed out, we'll run the migration from within Railway's network using Railway CLI.

## Step 1: Make Sure You're in the API Directory

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
```

## Step 2: Run the Migration via Railway CLI

Run this command - it will execute the migration script from within Railway's network:

```bash
railway run pnpm db:run-migration-sql
```

This will:
1. Connect to Railway's network
2. Use the DATABASE_URL from Railway environment
3. Execute the migration SQL
4. Baseline the migration for Prisma

## Alternative: If Railway CLI Not Linked

If Railway CLI asks to link, you can also:

1. **Commit and push the migration script:**
   ```bash
   git add .
   git commit -m "Add migration runner script"
   git push
   ```

2. **Then run it via Railway's web interface:**
   - Go to Railway Dashboard
   - Click on @hos-marketplace/api service
   - Go to "Settings" tab
   - Look for "Run Command" or "One-off Commands"
   - Run: `pnpm db:run-migration-sql`

## What the Script Does

The `run-migration.ts` script:
- Reads the SQL file from `prisma/migrations/run_and_baseline.sql`
- Executes all SQL statements
- Creates Prisma migrations table
- Adds all new columns and tables
- Baselines the migration

## After Running

1. **Check the output** - you should see:
   ```
   ✅ Migration completed successfully!
   ✅ Database schema updated
   ✅ Prisma migrations table baselined
   ```

2. **Restart the API service** (or wait for auto-restart)

3. **Check logs** - you should see:
   ```
   ✅ Database is up to date - no pending migrations
   ```

## Verify Migration Worked

After running, you can verify by checking Railway logs or running:

```bash
railway run pnpm prisma studio
```

Then check if the new columns exist in the `users` table.

