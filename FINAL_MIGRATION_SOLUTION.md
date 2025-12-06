# Final Solution: Run Migration Using GUI Client

Since Railway doesn't have a built-in SQL editor and network connections are timing out, the **easiest solution is to use a GUI PostgreSQL client**.

## Recommended: Use TablePlus (Free, Easy)

### Step 1: Download TablePlus
- **macOS:** https://tableplus.com/
- Download and install (it's free)

### Step 2: Get Connection Details from Railway
1. Go to Railway Dashboard → Postgres service
2. Click **"Connect"** button
3. Click **"Public Network"** tab
4. Copy the **Connection URL**:
   ```
   postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:5432/railway
   ```

### Step 3: Connect in TablePlus
1. Open TablePlus
2. Click **"Create a new connection"**
3. Select **PostgreSQL**
4. Paste the connection URL in the **"URL"** field, OR enter manually:
   - **Host:** `gondola.proxy.rlwy.net`
   - **Port:** `5432`
   - **User:** `postgres`
   - **Password:** `pYPWIdwzfQxyQQuobcwivtlfgFPgoekM`
   - **Database:** `railway`
5. Click **"Test"** then **"Connect"**

### Step 4: Run the Migration SQL
1. In TablePlus, click the **SQL icon** (or press Cmd+T)
2. Open the file: `services/api/prisma/migrations/run_and_baseline.sql`
3. **Copy the entire contents** (all 133 lines)
4. **Paste into TablePlus SQL editor**
5. Click **"Run"** (or press Cmd+R)
6. Wait for it to complete

### Step 5: Verify
Run this query in TablePlus:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'country';
```
Should return: `country`

---

## Alternative: Use pgAdmin (Free, Open Source)

1. Download: https://www.pgadmin.org/download/
2. Install and open
3. Right-click "Servers" → "Create" → "Server"
4. Enter connection details from Railway
5. Connect, then open Query Tool
6. Paste and run the SQL

---

## Alternative: Use DBeaver (Free, Cross-platform)

1. Download: https://dbeaver.io/download/
2. Install and open
3. New Database Connection → PostgreSQL
4. Enter connection details
5. Connect, open SQL Editor
6. Paste and run the SQL

---

## After Migration Runs

1. **Restart API Service:**
   - Go to Railway → @hos-marketplace/api
   - Click "Redeploy" or wait for auto-restart

2. **Check Logs:**
   - You should see: "✅ Database is up to date - no pending migrations"

3. **Verify Features Work:**
   - Registration page should show new fields
   - Profile page should show new settings
   - Currency selector should work

---

## Why This Works

- GUI clients handle network connections better than command line
- TablePlus is specifically designed for PostgreSQL
- It's free and easy to use
- You can see the results visually
- No need for complex CLI commands

---

**The migration SQL file is ready at:**
`services/api/prisma/migrations/run_and_baseline.sql`

Just copy, paste, and run in any PostgreSQL client!

