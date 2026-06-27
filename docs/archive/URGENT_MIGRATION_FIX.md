# 🚨 URGENT: Migration Didn't Actually Run - Fix Database Schema

## ❌ Problem

The migration API endpoint reported success, but the database tables/columns **don't actually exist**:
- `users.currencyPreference` column missing
- `currency_exchange_rates` table missing

**Error:**
```
The column `users.currencyPreference` does not exist in the current database.
The table `public.currency_exchange_rates` does not exist in the current database.
```

## 🔍 Root Cause

The migration SQL file might not have been found or executed correctly in production. The SQL statements may have failed silently.

## ✅ Solution: Run Migration SQL Directly in Railway

### Method 1: Via Railway PostgreSQL Service (Recommended)

1. **Go to Railway Dashboard**
2. **Select:** Your **PostgreSQL** service
3. **Click:** **"Data"** tab or **"Query"** tab
4. **Copy the SQL from:** `services/api/prisma/migrations/run_and_baseline.sql`
5. **Paste and execute** the entire SQL script
6. **Verify** by running:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name = 'currencyPreference';
   
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'currency_exchange_rates';
   ```

### Method 2: Via Railway CLI (If you have it installed)

```bash
railway connect postgres
# Then paste and run the SQL from run_and_baseline.sql
```

### Method 3: Fix Migration Controller and Re-run

I've updated the migration controller to:
- Try multiple file paths
- Better error logging
- More detailed error reporting

**After deploying the fix:**
1. Redeploy the API service
2. Run the migration endpoint again
3. Check the detailed error logs

---

## 📋 Quick SQL to Run

**Essential SQL statements to fix immediately:**

```sql
-- Add currencyPreference column to users
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

-- Add other missing columns
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "gdprConsent" BOOLEAN DEFAULT false;
```

**Run these in Railway PostgreSQL service → Query tab**

---

## 🔧 After Running SQL

1. **Restart API service** (to regenerate Prisma client)
2. **Test currency endpoints:**
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/currency/rates
   ```
   Should return `200 OK`

3. **Refresh admin dashboard** - errors should be gone

---

## 📝 What I Fixed

1. **Migration Controller:**
   - Now tries multiple file paths
   - Better error logging
   - More detailed error reporting

2. **Next Steps:**
   - Run SQL directly in Railway PostgreSQL
   - Or redeploy and re-run migration endpoint

---

**Status:** 🟥 Database schema missing → 🟡 Run SQL directly → 🟢 Schema fixed → 🟡 Redeploy API

