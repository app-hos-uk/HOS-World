# 🔄 Prisma Migration Guide - Railway Production

## Current Status

From your logs:
- ✅ Server is running successfully
- ⚠️ Prisma migrations table not found
- ⚠️ Database needs baselining
- ✅ All other services working (Redis, Elasticsearch, etc.)

## Solution: Run Migration via API Endpoint

You have an admin API endpoint to run migrations! Here's how:

### Method 1: Use Admin API Endpoint (Easiest)

**Endpoint**: `POST /api/admin/migration/run-global-features`

**Steps**:
1. **Get Admin Token**:
   - Login as admin user
   - Get JWT token from response

2. **Call Migration Endpoint**:
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/run-global-features \
     -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Check Response**:
   - Should return success message
   - Creates `_prisma_migrations` table
   - Applies all schema changes
   - Baselines the database

### Method 2: Use Railway CLI (If Available)

```bash
# Connect to Railway
railway link

# Run migration script
railway run --service @hos-marketplace/api pnpm db:run-migration-sql
```

### Method 3: Direct SQL via Railway Dashboard

1. **Railway Dashboard** → PostgreSQL service
2. **Query** tab (or use Railway CLI)
3. **Copy SQL** from `services/api/prisma/migrations/run_and_baseline.sql`
4. **Execute** the SQL

### Method 4: Use Admin Dashboard (If Available)

If you have admin dashboard access:
1. Go to: `/admin/migration-features`
2. Click **"Run Migration"** button
3. Monitor the results

---

## What the Migration Does

1. **Creates `_prisma_migrations` table** (Prisma tracking)
2. **Adds global platform fields** to `users` table:
   - country, whatsappNumber, preferredCommunicationMethod
   - currencyPreference (defaults to GBP)
   - gdprConsent, gdprConsentDate, dataProcessingConsent
   - ipAddress, countryDetectedAt

3. **Adds fields to `customers` table**:
   - country, currencyPreference

4. **Creates new tables**:
   - `currency_exchange_rates` (for multi-currency support)
   - `gdpr_consent_logs` (for GDPR compliance)

5. **Updates currency defaults**:
   - Changes default from USD to GBP in products, carts, orders, payments, settlements

6. **Creates indexes** for performance

7. **Initializes default exchange rates**

---

## After Migration

Once migration completes:

1. **Restart API Service** (if needed):
   - Railway will auto-restart on next deployment
   - Or manually restart from Railway dashboard

2. **Verify Migration**:
   - Check logs should show: `✅ Database is up to date - no pending migrations`
   - No more "migrations table not found" warning

3. **Test Features**:
   - User registration with country/currency
   - Currency conversion
   - GDPR consent logging

---

## Quick Command Reference

```bash
# Run migration via API (after getting admin token)
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/run-global-features \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or via Railway CLI
railway run --service @hos-marketplace/api pnpm db:run-migration-sql
```

---

## Verification

After running migration, check logs for:
- ✅ `✅ Database migrations applied successfully`
- ✅ `✅ Database is up to date - no pending migrations`
- ❌ No more `⚠️ Prisma migrations table not found`

---

**Recommended**: Use Method 1 (API endpoint) - it's the easiest and safest for production.

