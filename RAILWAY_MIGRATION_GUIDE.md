# Railway Migration Guide - Add Global Features

## Current Status
✅ Railway CLI is linked and authenticated
✅ Migration files are ready
✅ PrismaService will auto-run migrations on deployment

## Option 1: Automatic Migration (Recommended - Easiest)

**Just deploy to Railway!** The migration will run automatically because:
- PrismaService runs `prisma migrate deploy` on startup
- Migration files are included in your Docker image

**Steps:**
1. Commit and push your changes to your repository
2. Railway will auto-deploy (if connected to GitHub) OR
3. Manually trigger deployment in Railway dashboard
4. Check deployment logs - you'll see migration running

**To verify migration ran:**
- Check Railway deployment logs for: "✅ Database migrations applied successfully"
- Or check logs for: "No pending migrations" (means already applied)

---

## Option 2: Manual Migration via Railway PostgreSQL Service

Since Railway CLI can't connect to internal URLs from local, use Railway's web interface:

### Step 1: Access PostgreSQL Service
1. Go to Railway Dashboard: https://railway.app
2. Click on your **PostgreSQL** service (not the API service)
3. Go to **"Data"** tab or **"Query"** tab

### Step 2: Run Migration SQL
1. Open the SQL editor/query interface
2. Copy the entire contents of: `services/api/prisma/migrations/add_global_features.sql`
3. Paste into the SQL editor
4. Click **"Run"** or **"Execute"**

### Step 3: Verify Migration
Run these queries to verify:

```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('country', 'currencyPreference', 'gdprConsent');

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('currency_exchange_rates', 'gdpr_consent_logs');
```

---

## Option 3: Use Railway Shell/Console

Some Railway projects have a "Shell" or "Console" feature:

1. Go to Railway Dashboard
2. Click on **@hos-marketplace/api** service
3. Look for **"Shell"**, **"Console"**, or **"Terminal"** tab
4. If available, run:
   ```bash
   npx prisma migrate deploy
   ```

---

## Option 4: Add Migration to Railway Service Command

You can add a one-time migration command to Railway:

1. Go to Railway Dashboard
2. Click **@hos-marketplace/api** service
3. Go to **"Settings"** tab
4. Look for **"Deploy Command"** or **"Start Command"**
5. Temporarily change it to:
   ```bash
   npx prisma migrate deploy && node dist/main.js
   ```
6. Save and redeploy
7. After migration runs, change it back to: `node dist/main.js`

---

## Option 5: Use Railway's Public Database URL

If Railway provides a public database URL (not internal):

1. Go to Railway Dashboard
2. Click **PostgreSQL** service
3. Go to **"Variables"** tab
4. Look for `DATABASE_URL` or `PUBLIC_DATABASE_URL`
5. If there's a public URL, use it locally:
   ```bash
   cd services/api
   DATABASE_URL='public-url-here' npx prisma migrate deploy
   ```

---

## Recommended Approach

**Just deploy normally** - the migration will run automatically on startup because:
- ✅ PrismaService has been updated to run migrations
- ✅ Migration files are in the correct location
- ✅ Railway will include them in the deployment

**After deployment, check logs for:**
- "🔄 Running database migrations..."
- "✅ Database migrations applied successfully"

---

## Troubleshooting

### If migration doesn't run automatically:
1. Check Railway deployment logs
2. Look for PrismaService initialization messages
3. Verify `NODE_ENV=production` is set
4. Check that migration files are in the Docker image

### If you see errors:
- Migration already applied: That's fine - means it worked!
- Connection errors: Use Option 2 (direct SQL)
- Missing files: Ensure migration directory is in Docker image

---

## Verification Queries

After migration, run these in Railway PostgreSQL service:

```sql
-- 1. Check users table has new columns
\d users

-- 2. Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('currency_exchange_rates', 'gdpr_consent_logs');

-- 3. Check currency defaults
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'currency';
```

---

**Note:** The migration is safe to run multiple times (uses IF NOT EXISTS checks).

