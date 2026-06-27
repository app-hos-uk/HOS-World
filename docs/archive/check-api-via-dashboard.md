# Check API Status via Railway Dashboard

Since the CLI isn't linked, you can check everything via the Railway Dashboard:

## Step 1: Access Railway Dashboard

1. Go to: https://railway.app/dashboard
2. Log in if needed
3. Find your project (likely named `hos-marketplace` or similar)

## Step 2: Select API Service

1. Click on your project
2. Find the service named:
   - `api`
   - `@hos-marketplace/api`
   - Or the service with URL: `hos-marketplaceapi-production.up.railway.app`

## Step 3: Check Logs

1. Click on the API service
2. Go to the **Logs** tab
3. Look for recent startup logs

**Look for these SUCCESS messages:**
```
✅ Server is listening on port 3001
✅ API server is running on: http://0.0.0.0:3001/api
✅ Health check available at: http://0.0.0.0:3001/api/health
✅ Pre-flight check PASSED - All models found
```

**Look for these ERROR messages:**
```
❌ RefreshToken model missing from PrismaClient
❌ Prisma client missing basic models
Error: P1001: Can't reach database server
Error: Cannot find module
TypeError: Cannot read properties
```

## Step 4: Check Environment Variables

1. Go to the **Variables** tab
2. Verify these are set:
   - `DATABASE_URL` - Should be a PostgreSQL connection string
   - `JWT_SECRET` - Should be set
   - `PORT` - Should be set (or defaults to 3001)
   - `NODE_ENV` - Should be `production`

## Step 5: Check Deployments

1. Go to the **Deployments** tab
2. Check the latest deployment:
   - Status should be "Active" or "Ready"
   - Build should have completed successfully
   - Look for any build errors

## Step 6: Check Service Status

1. Go to the **Settings** tab
2. Check:
   - Service is running
   - Health checks are passing (if configured)
   - No restart loops

## Common Issues Found in Dashboard

### Issue 1: Database Connection Failed
**In Logs:**
```
Error: P1001: Can't reach database server
```

**Fix:**
- Check `DATABASE_URL` in Variables tab
- Verify database service is running
- Check database credentials

### Issue 2: Prisma Client Missing
**In Logs:**
```
❌ RefreshToken model missing from PrismaClient
❌ Prisma client missing basic models
```

**Fix:**
- Add to build command: `pnpm db:generate`
- Or add to package.json scripts
- Redeploy the service

### Issue 3: Routes Not Registering
**Symptom:**
- All `/api/*` endpoints return 404
- Root `/` endpoint works

**Possible Causes (check logs):**
- Database connection failed
- Prisma client not generated
- Module initialization error

## What to Share

After checking the dashboard, share:
1. **Recent logs** (last 50-100 lines)
2. **Environment variables** (names only, not values)
3. **Latest deployment status**
4. **Any error messages** you see

This will help identify why routes aren't working!
