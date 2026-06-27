# Railway Deployment Verification Checklist

> **Note**: For a comprehensive production readiness guide, see [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md)

## Priority 1: Verify Railway Deployment

### Step 1: Check Railway Project Status
- [ ] Login to Railway dashboard: https://railway.app
- [ ] Navigate to project: HOS-World Production Deployment
- [ ] Verify all services are present:
  - [ ] PostgreSQL service (running)
  - [ ] Redis service (if applicable)
  - [ ] @hos-marketplace/api service (running)
  - [ ] @hos-marketplace/web service (if applicable)

### Step 2: Check API Service Status
- [ ] Go to @hos-marketplace/api service
- [ ] Check service status (should be "Active" or "Running")
- [ ] Check latest deployment status (should be "Success" or "Active")
- [ ] Review deployment logs for errors
- [ ] Check for any crash loops or restart issues

### Step 3: Verify Database Migration
- [ ] Connect to Railway PostgreSQL database
- [ ] Run: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'oauth_accounts');`
- [ ] Should return `true` (OAuthAccount table exists)
- [ ] Verify migration was applied successfully
- [ ] Check Prisma client generation (should be automatic on deploy)

### Step 4: Test API Endpoints

**Health Check:**
```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/health
```
- [ ] Returns 200 OK
- [ ] Response includes status information

**Root Endpoint:**
```bash
curl https://hos-marketplaceapi-production.up.railway.app/
```
- [ ] Returns API information

**API Documentation:**
```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/docs
```
- [ ] Swagger UI is accessible

### Step 5: Check Environment Variables

Go to Railway Dashboard → @hos-marketplace/api → Variables tab

**Critical Variables:**
- [ ] `DATABASE_URL` - Set (from PostgreSQL service)
- [ ] `JWT_SECRET` - Set (32+ characters)
- [ ] `JWT_REFRESH_SECRET` - Set (32+ characters, different from JWT_SECRET)

**Recommended Variables:**
- [ ] `REDIS_URL` - Set (if using Redis)
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Set (or Railway auto-assigns)
- [ ] `FRONTEND_URL` - Set to production frontend URL

**Generate JWT Secrets (if missing):**
```bash
cd services/api
./scripts/generate-jwt-secrets.sh
```

---

## Quick Verification Commands

### Using Railway CLI (if logged in):
```bash
# Check service status
railway status

# List services
railway service list

# Check variables
railway variables --service @hos-marketplace/api

# View logs
railway logs --service @hos-marketplace/api
```

### Using Local Verification Script:
```bash
cd services/api
pnpm verify:deployment https://hos-marketplaceapi-production.up.railway.app
```

---

## Verification Results

**Date**: [To be filled]  
**Status**: [To be filled]  
**Issues Found**: [To be filled]  
**Actions Taken**: [To be filled]

---

## Related Documentation

- [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md) - Comprehensive guide
- [Environment Variables Checklist](./ENV_VAR_CHECKLIST.md) - Complete env var reference
