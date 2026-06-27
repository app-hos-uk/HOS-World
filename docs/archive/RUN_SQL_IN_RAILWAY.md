# 🚀 Run Migration SQL Directly in Railway PostgreSQL

## ⚡ Quick Fix - Run SQL in Railway

The migration API endpoint didn't actually create the tables. Run the SQL directly:

### Step 1: Access Railway PostgreSQL

1. **Go to Railway Dashboard:** https://railway.app
2. **Select:** Your **PostgreSQL** service (not the API service)
3. **Click:** **"Data"** tab or **"Query"** tab
4. **You should see:** A SQL query editor or database browser

### Step 2: Copy the SQL

**Open this file:** `services/api/prisma/migrations/run_and_baseline.sql`

**Copy the ENTIRE contents** (all 133 lines)

### Step 3: Execute in Railway

1. **Paste the SQL** into the Railway PostgreSQL query editor
2. **Click "Run"** or "Execute"
3. **Wait for completion** - should take a few seconds
4. **Check for errors** - if you see "already exists" errors, that's okay

### Step 4: Verify

**Run this verification query:**

```sql
-- Check if currencyPreference column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'currencyPreference';

-- Check if currency_exchange_rates table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'currency_exchange_rates';
```

**Expected Results:**
- First query should return: `currencyPreference`
- Second query should return: `currency_exchange_rates`

### Step 5: Restart API Service

1. **Go to Railway Dashboard**
2. **Select:** `@hos-marketplace/api` service
3. **Click:** **"Deployments"** tab
4. **Click:** **"Redeploy"** button
5. **Wait:** 3-5 minutes

**Why restart?** The Prisma client needs to be regenerated to recognize the new tables/columns.

### Step 6: Test

After restart, test:
```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/currency/rates
```

Should return `200 OK` with JSON (not 500)

---

## 🎯 Alternative: Minimal SQL (If Full Script Fails)

If the full script has issues, run just the essential parts:

```sql
-- Add currencyPreference column
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "currencyPreference" TEXT DEFAULT 'GBP';

-- Create currency_exchange_rates table
CREATE TABLE IF NOT EXISTS "currency_exchange_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "targetCurrency" TEXT NOT NULL,
    "rate" DECIMAL(10, 6) NOT NULL,
    "cachedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP NOT NULL,
    CONSTRAINT "currency_exchange_rates_baseCurrency_targetCurrency_key" UNIQUE ("baseCurrency", "targetCurrency")
);

-- Add other essential columns
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "gdprConsent" BOOLEAN DEFAULT false;
```

---

## ✅ After SQL Runs Successfully

1. ✅ Database has the tables/columns
2. 🟡 **Redeploy API service** (to regenerate Prisma client)
3. ✅ Currency endpoints work
4. ✅ All errors resolved

---

**Status:** 🟥 SQL not executed → 🟡 Run SQL in Railway → 🟡 Redeploy API → 🟢 Fixed

