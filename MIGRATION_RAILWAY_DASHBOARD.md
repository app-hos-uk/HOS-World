# Run Phase 6 Migration via Railway Dashboard

## Quick Steps

1. **Go to Railway Dashboard**
   - Open: https://railway.app
   - Select your project

2. **Open PostgreSQL Service**
   - Click on your **PostgreSQL** service (not the API service)

3. **Open Data/Query Tab**
   - Look for **"Data"** or **"Query"** tab
   - If you see "Connect" or "Query" button, click it

4. **Copy SQL Migration**
   - Open the file: `services/api/prisma/migrations/phase6_fandom_features.sql`
   - Copy **ALL** the SQL content (the entire file)

5. **Paste and Execute**
   - Paste the SQL into the query editor
   - Click **"Run"** or **"Execute"** button

6. **Verify Success**
   - You should see success messages
   - Tables should be created

7. **Restart API Service**
   - Go back to your project
   - Click on **`@hos-marketplace/api`** service
   - Click **"Restart"** button (or it may auto-restart)

## Alternative: If Railway Dashboard doesn't have Query tab

If you can't find a Query/Data tab in Railway Dashboard, you can:

1. **Use Railway CLI to connect:**
   ```bash
   railway connect postgres
   ```
   Then paste the SQL when connected.

2. **Or use a PostgreSQL client:**
   - Get the public connection string from Railway Dashboard → PostgreSQL → Variables → `DATABASE_URL`
   - Use a tool like pgAdmin, DBeaver, or VS Code PostgreSQL extension
   - Connect and run the SQL

## SQL File Location
`services/api/prisma/migrations/phase6_fandom_features.sql`

## What This Migration Does
- Creates `fandoms` table
- Creates `characters` table  
- Creates `ai_chats` table
- Creates `badges`, `user_badges` tables
- Creates `quests`, `user_quests` tables
- Creates `collections`, `shared_items` tables
- Adds new columns to `users` table

## After Migration
✅ `/api/characters` endpoint will work (returns empty array if no data)
✅ `/api/fandoms` endpoint will work (returns empty array if no data)
✅ Login should work properly
✅ No more 500 errors

