# Run Phase 6 Migration - Fix 500 Errors

## Problem
The `/api/characters` and `/api/fandoms` endpoints are returning 500 errors because the database tables don't exist yet.

## Solution
Run the Phase 6 migration SQL on the Railway PostgreSQL database.

## Step 1: Get Database Connection String

1. Go to Railway Dashboard
2. Select your **PostgreSQL** service
3. Go to **Variables** tab
4. Copy the `DATABASE_URL` value

## Step 2: Run Migration

### Option A: Using Railway CLI (Recommended)

```bash
cd services/api
railway run --service @hos-marketplace/api psql $DATABASE_URL -f prisma/migrations/phase6_fandom_features.sql
```

### Option B: Using Railway Dashboard

1. Go to Railway Dashboard → PostgreSQL service
2. Click on **Data** tab (or **Query** tab if available)
3. Copy the contents of `services/api/prisma/migrations/phase6_fandom_features.sql`
4. Paste and execute the SQL

### Option C: Using psql directly (if you have access)

```bash
psql $DATABASE_URL -f services/api/prisma/migrations/phase6_fandom_features.sql
```

## Step 3: Verify Tables Created

After running the migration, verify the tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('fandoms', 'characters', 'ai_chats', 'badges', 'user_badges', 'quests', 'user_quests', 'collections', 'shared_items');
```

You should see all 9 tables listed.

## Step 4: Restart API Service

After migration:
1. Go to Railway Dashboard → `@hos-marketplace/api` service
2. Click **Restart** (or it may auto-restart)

## Step 5: Test Endpoints

After restart, test the endpoints:

```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/characters
curl https://hos-marketplaceapi-production.up.railway.app/api/fandoms
```

Both should return empty arrays `{"data":[],"message":"..."}` instead of 500 errors.

## Step 6: Seed Initial Data (Optional)

If you want to add some test data:

```sql
-- Insert some fandoms
INSERT INTO fandoms (name, slug, description, is_active) VALUES
('Harry Potter', 'harry-potter', 'The wizarding world of Harry Potter', true),
('Lord of the Rings', 'lord-of-the-rings', 'Middle-earth adventures', true),
('Game of Thrones', 'game-of-thrones', 'The Seven Kingdoms', true);

-- Insert some characters
INSERT INTO characters (fandom_id, name, description, is_active)
SELECT id, 'Hermione Granger', 'Brilliant witch and friend', true
FROM fandoms WHERE slug = 'harry-potter';
```

## Current Status
✅ Prisma schema updated with Character and Fandom models
⏳ Waiting for migration to be run on Railway database
⏳ After migration, API endpoints should work

