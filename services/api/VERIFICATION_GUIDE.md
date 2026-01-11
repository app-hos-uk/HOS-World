# Verification Scripts Guide

## Quick Start

All verification scripts must be run from the `services/api` directory:

```bash
cd services/api
```

---

## Available Scripts

### 1. Environment Variables Verification

**Command**: `pnpm verify:env`

**What it checks**:
- Required variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- Optional variables: OAuth, payments, storage, etc.
- Validates formats and lengths

**Usage**:
```bash
cd services/api
pnpm verify:env
```

**For Production (Railway)**:
The script checks the local `.env` file by default. To check Railway environment variables, you need to:
1. Use Railway CLI: `railway variables`
2. Or check Railway Dashboard → Variables tab
3. Or set variables locally in `.env` file for testing

**Expected Output**:
- ✅ Shows which variables are set and valid
- ❌ Shows which required variables are missing
- ⚠️  Shows optional variables status

---

### 2. OAuthAccount Table Verification

**Command**: `pnpm verify:oauth`

**What it checks**:
- OAuthAccount table exists in database
- Table structure is correct
- Required indexes are present
- Sample data (if any)

**Usage**:
```bash
cd services/api
pnpm verify:oauth
```

**Prerequisites**:
- `DATABASE_URL` must be set in `.env` or environment
- Database must be accessible
- Migration must have been run

**Expected Output**:
- ✅ Table exists and structure is correct
- ✅ Indexes are present
- ℹ️  Shows sample data if available
- ❌ Error if table doesn't exist (run migration)

---

### 3. Deployment Verification

**Command**: `pnpm verify:deployment [API_URL]`

**What it checks**:
- API is responding
- Health endpoint works
- Database connection
- Redis connection

**Usage**:
```bash
cd services/api
pnpm verify:deployment https://hos-marketplaceapi-production.up.railway.app
```

---

## Common Issues

### Issue: "Command not found"
**Solution**: Make sure you're in the `services/api` directory:
```bash
cd services/api
pnpm verify:env
```

### Issue: "DATABASE_URL missing"
**Solution**: 
- For local: Add to `services/api/.env` file
- For production: Check Railway Dashboard → Variables

### Issue: "OAuthAccount table not found"
**Solution**: Run migration:
```bash
cd services/api
pnpm db:migrate
```

---

## Railway Production Verification

To verify production environment variables:

1. **Via Railway Dashboard**:
   - Go to: https://railway.app
   - Navigate to your project → @hos-marketplace/api → Variables
   - Check all required variables are set

2. **Via Railway CLI**:
   ```bash
   railway variables --service @hos-marketplace/api
   ```

3. **Via API Health Check**:
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/health
   ```

---

## Script Locations

- `scripts/verify-env-vars.ts` - Environment variables
- `scripts/verify-oauth-table.ts` - OAuthAccount table
- `scripts/verify-deployment.ts` - Deployment status

All scripts are in: `services/api/scripts/`
