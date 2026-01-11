# Production Readiness Checklist

## ✅ Completed Tasks

### Code Quality
- [x] Removed debug instrumentation from integration tests
- [x] Reviewed and prioritized TODO comments
- [x] OAuthAccount model added to Prisma schema
- [x] OAuth unlinking feature enabled
- [x] Queue system image processing implemented
- [x] Storage service local deletion implemented

### Database
- [x] OAuthAccount migration created and applied
- [x] Prisma schema updated with OAuthAccount model
- [x] User.password field made optional for OAuth users

---

## 🔍 Current Verification Status

### Environment Variables (Required for Production)

#### ✅ Critical (Must Have)
- [ ] `DATABASE_URL` - PostgreSQL connection string
  - **Status**: ⚠️ Needs verification in Railway
  - **Action**: Verify in Railway dashboard → @hos-marketplace/api → Variables
  - **Format**: `postgresql://postgres:password@host:port/database`

- [ ] `JWT_SECRET` - JWT signing secret (minimum 32 characters)
  - **Status**: ⚠️ Needs verification/generation
  - **Action**: Generate with `openssl rand -base64 32`
  - **Verify**: Check in Railway dashboard

- [ ] `JWT_REFRESH_SECRET` - Refresh token secret (different from JWT_SECRET)
  - **Status**: ⚠️ Needs verification/generation
  - **Action**: Generate with `openssl rand -base64 32`
  - **Verify**: Check in Railway dashboard

#### ⚠️ Recommended (Should Have)
- [ ] `REDIS_URL` - Redis connection string
  - **Status**: ⚠️ Needs verification
  - **Action**: Check if Redis service is provisioned in Railway

- [ ] `PORT` - Server port
  - **Status**: ⚠️ Defaults to 3001 if not set
  - **Action**: Verify Railway sets this automatically

- [ ] `NODE_ENV` - Environment
  - **Status**: ⚠️ Should be `production` in Railway
  - **Action**: Verify in Railway dashboard

- [ ] `FRONTEND_URL` - Frontend URL for CORS
  - **Status**: ⚠️ Needs verification
  - **Action**: Set to production frontend URL

---

## 🚂 Railway Deployment Verification Steps

### Step 1: Verify Services in Railway Dashboard

1. **Login to Railway Dashboard**
   - Go to: https://railway.app
   - Navigate to your project

2. **Check Service Status**
   - [ ] PostgreSQL service is running
   - [ ] Redis service is running (if applicable)
   - [ ] @hos-marketplace/api service is running
   - [ ] @hos-marketplace/web service is running (if applicable)

3. **Check Latest Deployment**
   - [ ] Go to @hos-marketplace/api → Deployments tab
   - [ ] Verify latest deployment status is "Active" or "Success"
   - [ ] Check deployment logs for errors

### Step 2: Verify Environment Variables

1. **Go to @hos-marketplace/api → Variables tab**
2. **Verify Required Variables:**
   - [ ] `DATABASE_URL` is set (from PostgreSQL service)
   - [ ] `JWT_SECRET` is set (32+ characters)
   - [ ] `JWT_REFRESH_SECRET` is set (32+ characters, different from JWT_SECRET)
   - [ ] `REDIS_URL` is set (if Redis is used)
   - [ ] `NODE_ENV` is set to `production`
   - [ ] `PORT` is set (or Railway auto-assigns)
   - [ ] `FRONTEND_URL` is set to production URL

3. **Generate Missing JWT Secrets (if needed):**
   ```bash
   # Generate JWT_SECRET
   openssl rand -base64 32
   
   # Generate JWT_REFRESH_SECRET (run again for different value)
   openssl rand -base64 32
   ```

### Step 3: Verify Database Migration

1. **Check OAuthAccount Table Exists:**
   - Connect to Railway PostgreSQL database
   - Run: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'oauth_accounts');`
   - [ ] Should return `true`

2. **Verify Prisma Client:**
   - [ ] Migration was applied successfully
   - [ ] Prisma client was regenerated with `pnpm db:generate`

### Step 4: Test API Endpoints

1. **Health Check:**
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/health
   ```
   - [ ] Returns 200 OK
   - [ ] Response includes status information

2. **Root Endpoint:**
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/
   ```
   - [ ] Returns API information

3. **API Documentation:**
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/docs
   ```
   - [ ] Swagger UI is accessible

### Step 5: Verify OAuth Functionality

1. **Check OAuth Unlinking:**
   - [ ] OAuthAccount model exists in Prisma schema ✅
   - [ ] `getLinkedAccounts()` method is enabled ✅
   - [ ] `unlinkOAuthAccount()` method is enabled ✅
   - [ ] Test OAuth unlinking endpoint (requires authentication)

---

## 🔧 Local Verification (Before Deployment)

### Run Verification Script

```bash
cd services/api
pnpm verify:deployment [API_URL]
```

**Expected Output:**
- ✅ All required environment variables are set
- ✅ Database connection successful
- ✅ OAuthAccount table exists
- ✅ Health endpoint responds

### Manual Database Check

```bash
cd services/api
pnpm db:generate
pnpm db:studio  # Open Prisma Studio to verify OAuthAccount table
```

---

## 📋 Optional Environment Variables

These are only needed if you're using specific features:

### OAuth Providers
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `APPLE_CLIENT_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY_PATH`

### File Storage
- `STORAGE_PROVIDER` (local/s3/minio/cloudinary)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Search (Elasticsearch)
- `ELASTICSEARCH_NODE`
- `ELASTICSEARCH_USERNAME`
- `ELASTICSEARCH_PASSWORD`

### Payment Processing
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Email (SMTP)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

---

## 🚨 Common Issues & Solutions

### Issue: Database Connection Failed
**Solution:**
- Verify `DATABASE_URL` is correct in Railway
- Check PostgreSQL service is running
- Verify database credentials

### Issue: JWT Secret Too Short
**Solution:**
- Generate new secret: `openssl rand -base64 32`
- Update in Railway dashboard
- Restart service

### Issue: OAuthAccount Table Missing
**Solution:**
- Run migration: `pnpm db:migrate`
- Or use: `pnpm db:push` (for development)
- Regenerate Prisma client: `pnpm db:generate`

### Issue: API Not Responding
**Solution:**
- Check Railway deployment logs
- Verify service is running
- Check environment variables are set
- Verify PORT is correct

---

## ✅ Final Checklist Before Going Live

- [ ] All required environment variables are set in Railway
- [ ] Database migration applied (OAuthAccount table exists)
- [ ] Prisma client regenerated
- [ ] Health endpoint responds correctly
- [ ] API documentation is accessible
- [ ] CORS is configured correctly
- [ ] JWT secrets are strong (32+ characters)
- [ ] NODE_ENV is set to `production`
- [ ] All services are running in Railway
- [ ] Deployment logs show no errors
- [ ] OAuth unlinking feature is enabled and tested

---

## 📝 Notes

- **Last Updated**: 2024-12-06
- **OAuthAccount Migration**: Applied ✅
- **Verification Script**: Available at `services/api/scripts/verify-deployment.ts`
- **Railway API URL**: `https://hos-marketplaceapi-production.up.railway.app`

---

## 🔗 Quick Links

- [Railway Dashboard](https://railway.app)
- [Environment Variables Checklist](./ENV_VAR_CHECKLIST.md)
- [Railway Verification Checklist](./RAILWAY_VERIFICATION_CHECKLIST.md)
