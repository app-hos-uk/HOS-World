# 🔧 Fix Currency 500 Errors After Migration

## ❌ Problem

After running the migration, you're still getting 500 errors on:
- `/api/currency/user-currency`
- `/api/currency/rates`

## 🔍 Root Cause

The **Prisma client** needs to be regenerated after the migration. The running service was built before the migration, so the Prisma client doesn't know about the new `CurrencyExchangeRate` model.

## ✅ Solution: Restart Railway Service

The Prisma client is regenerated during the Docker build. You need to restart/redeploy the Railway service.

### Option 1: Redeploy Service (Recommended)

1. **Go to Railway Dashboard**
2. **Select:** `@hos-marketplace/api` service
3. **Click:** **"Deployments"** tab
4. **Click:** **"Redeploy"** button
5. **Wait:** 3-5 minutes for rebuild and deployment

**What happens:**
- Docker rebuilds the image
- Runs `pnpm db:generate` (regenerates Prisma client)
- Prisma client now includes `CurrencyExchangeRate` model
- Service restarts with updated Prisma client

### Option 2: Manual Prisma Client Regeneration (If you have SSH access)

If you have access to the Railway container:

```bash
cd /app/services/api
pnpm db:generate
# Then restart the service
```

But Railway doesn't provide SSH by default, so **Option 1 is recommended**.

---

## 🔍 Verify After Restart

After the service restarts:

1. **Check logs** for:
   ```
   ✅ Database connected successfully
   ✅ Database is up to date - no pending migrations
   ```

2. **Test currency endpoint:**
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/currency/rates
   ```
   Should return `200 OK` with JSON (not 500)

3. **Refresh your admin dashboard** - currency errors should be gone

---

## 📋 Why This Happens

1. **Migration ran** → Database has new tables/columns ✅
2. **Prisma client not regenerated** → Service doesn't know about new models ❌
3. **Service tries to use `currencyExchangeRate`** → Prisma client doesn't have it → 500 error ❌

**After restart:**
1. **Build regenerates Prisma client** → Includes `CurrencyExchangeRate` model ✅
2. **Service starts with updated client** → Can access new models ✅
3. **Currency endpoints work** → No more 500 errors ✅

---

## 🎯 Quick Summary

**Action Required:** Redeploy Railway API service

**Why:** Prisma client needs regeneration to recognize new database tables

**Result:** Currency endpoints will work after redeploy

---

**Status:** 🟡 Migration complete → 🟡 Need to redeploy → 🟢 Currency endpoints working

