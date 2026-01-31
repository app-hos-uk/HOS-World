# Deployment Checklist - Global Features Migration

## 📋 Production Checklist (Ops)

Use this before and after deploying to production.

### Required environment variables (Railway / host)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 characters |
| `JWT_REFRESH_SECRET` | Yes | Min 32 characters |
| `REDIS_URL` | Yes* | Redis for cache/queue (e.g. `redis://...`) |
| `NODE_ENV` | Yes | Set to `production` |
| `SENTRY_DSN` | Recommended | Enables error and performance tracking in Sentry |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional | Default `0.1`; 0–1 |
| `FRONTEND_URL` | Yes | Allowed CORS origin (e.g. `https://your-app.up.railway.app`) |

\* Required for queue/cache; app can run with fallbacks if Redis is unavailable.

### Health endpoints

| Endpoint | Purpose |
|----------|--------|
| `GET /api/health` | Full health (DB, Redis, Elasticsearch) |
| `GET /api/health/live` | Liveness (process alive) – for orchestrator restarts |
| `GET /api/health/ready` | Readiness (DB/Redis ready) – for load balancer; returns 503 when not ready |

### Deployment config

- **Replicas:** `railway.json` has `numReplicas: 2` for horizontal scaling.
- **Restart:** `restartPolicyType: "ON_FAILURE"`, `restartPolicyMaxRetries: 10`.

### Post-deploy checks

1. Call `GET /api/health` – status should be `ok` or `degraded` (not `error`).
2. Call `GET /api/health/ready` – should return 200 when DB/Redis are up.
3. In Sentry: create a project, set `SENTRY_DSN` in Railway, trigger a test error and confirm it appears.

---

## ✅ Pre-Deployment Verification

All setup is complete:
- ✅ Migration files created in proper Prisma format
- ✅ PrismaService updated to auto-run migrations on startup
- ✅ All code changes implemented
- ✅ Migration directory: `services/api/prisma/migrations/20251206133014_add_global_features/`

---

## 🚀 Deployment Steps

### Step 1: Commit Your Changes (if not already committed)

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
git add .
git commit -m "feat: Add global platform features - multi-currency, GDPR, country detection"
git push
```

**Note:** If Railway is connected to GitHub, it will auto-deploy after push.

### Step 2: Deploy to Railway

**Option A: Auto-Deploy (if GitHub connected)**
- Just push to your repository
- Railway will automatically detect and deploy

**Option B: Manual Deploy**
1. Go to Railway Dashboard: https://railway.app
2. Click on **@hos-marketplace/api** service
3. Click **"Deploy"** or **"Redeploy"** button
4. Wait for deployment to complete

### Step 3: Monitor Deployment Logs

Watch the Railway deployment logs for these messages:

**Expected Success Messages:**
```
✅ Database connected successfully
🔄 Running database migrations...
✅ Database migrations applied successfully
```

**OR if migration already applied:**
```
✅ Database is up to date - no pending migrations
```

**If you see errors:**
- Check that `NODE_ENV=production` is set in Railway environment variables
- Verify migration files are in the Docker image
- Check database connection is working

---

## 🔍 Post-Deployment Verification

### 1. Check Migration Ran Successfully

**Via Railway Logs:**
- Look for: "✅ Database migrations applied successfully"
- Or: "✅ Database is up to date - no pending migrations"

**Via Database Query (in Railway PostgreSQL service):**
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('country', 'currencyPreference', 'gdprConsent');

-- Should return: country, currencyPreference, gdprConsent

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('currency_exchange_rates', 'gdpr_consent_logs');

-- Should return: currency_exchange_rates, gdpr_consent_logs
```

### 2. Test New Features

**Registration Page:**
- Visit registration page
- Verify country field appears
- Verify WhatsApp number field appears
- Verify communication method dropdown appears
- Verify GDPR consent checkbox appears

**Profile Page:**
- Login as a user
- Go to profile page
- Verify new fields are visible:
  - Country
  - WhatsApp Number
  - Preferred Communication Method
  - Currency Preference
  - GDPR Consent Settings

**Currency Conversion:**
- Check product pages show prices in user's currency
- Verify currency selector in header works
- Test currency conversion on checkout

**GDPR Features:**
- Verify GDPR consent banner appears (if not consented)
- Test consent management in profile
- Test data export functionality

---

## 🐛 Troubleshooting

### Migration Didn't Run

**Check:**
1. Railway environment variables:
   - `NODE_ENV=production` must be set
   - `DATABASE_URL` must be set correctly

2. PrismaService logs:
   - Look for "Running database migrations..." message
   - Check for any error messages

3. Migration files in Docker:
   - Verify `prisma/migrations/` directory is copied in Dockerfile
   - Check Dockerfile includes: `COPY --from=base /app/services/api/prisma ./services/api/prisma`

**Solution:**
- If migration didn't run automatically, use manual SQL method (see RAILWAY_MIGRATION_GUIDE.md)

### Migration Already Applied

**This is fine!** If you see "No pending migrations" or "already applied", it means:
- Migration ran successfully
- Database is up to date
- You can proceed with testing

### Database Connection Errors

**Check:**
- Railway PostgreSQL service is running
- `DATABASE_URL` environment variable is correct
- Network connectivity between services

---

## 📋 What Gets Migrated

1. **New User Fields:**
   - country, whatsappNumber, preferredCommunicationMethod
   - currencyPreference (defaults to GBP)
   - ipAddress, gdprConsent, gdprConsentDate
   - dataProcessingConsent (JSON), countryDetectedAt

2. **New Customer Fields:**
   - country, currencyPreference

3. **New Tables:**
   - `currency_exchange_rates` - Cached exchange rates
   - `gdpr_consent_logs` - Consent audit trail

4. **Currency Defaults:**
   - Changed from USD to GBP in: products, carts, orders, payments, settlements

5. **Indexes:**
   - Performance indexes for new columns and tables

6. **Data Backfill:**
   - Sets currencyPreference to GBP for existing users

---

## ✅ Success Criteria

Migration is successful when:
- ✅ Deployment logs show migration completed
- ✅ Database has new columns and tables
- ✅ Registration page shows new fields
- ✅ Profile page shows new settings
- ✅ Currency conversion works
- ✅ GDPR banner appears (if not consented)

---

## 🎉 Next Steps After Migration

1. **Test Registration:**
   - Register a new user with all new fields
   - Verify country auto-detection works
   - Verify GDPR consent is saved

2. **Test Currency:**
   - Change currency preference
   - Verify prices update
   - Test checkout with different currencies

3. **Test GDPR:**
   - Test consent banner
   - Test consent management in profile
   - Test data export
   - Test account deletion (anonymization)

4. **Monitor:**
   - Check Railway logs for any errors
   - Monitor currency conversion API calls
   - Check GDPR consent logs are being created

---

**Ready to deploy!** 🚀

Just commit, push, and deploy - the migration will run automatically!
