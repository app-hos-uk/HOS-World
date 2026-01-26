# Railway API Diagnostics Guide

## Quick Check Commands

Run these commands in your terminal to diagnose the API issue:

### 1. Check Railway CLI is installed
```bash
railway --version
```

If not installed:
```bash
npm install -g @railway/cli
railway login
```

### 2. Navigate to API directory
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
```

### 3. Check Service Status
```bash
railway status
```

### 4. Check Environment Variables
```bash
railway variables
```

Look for:
- `DATABASE_URL` - Should be set
- `JWT_SECRET` - Should be set
- `PORT` - Should be set (or defaults to 3001)
- `NODE_ENV` - Should be `production`

### 5. Check Recent Logs
```bash
railway logs --tail 100
```

**Look for:**
- ✅ `Server is listening on port 3001`
- ✅ `API server is running on: http://0.0.0.0:3001/api`
- ✅ `Health check available at: http://0.0.0.0:3001/api/health`
- ❌ Database connection errors
- ❌ Prisma client errors
- ❌ Module initialization errors

### 6. Check Deployments
```bash
railway deployments --limit 5
```

Check if the latest deployment:
- Completed successfully
- Is active
- Has the correct build

### 7. Check Service Details
```bash
railway service
```

## Automated Check Script

Run the automated check script:
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
bash check-railway-api.sh
```

## Common Issues to Look For

### 1. Database Connection Failed
**Symptoms:**
- Logs show: `Error: P1001: Can't reach database server`
- Logs show: `Prisma client missing basic models`

**Fix:**
- Verify `DATABASE_URL` is correct
- Check database is accessible from Railway
- Verify database credentials

### 2. Prisma Client Not Generated
**Symptoms:**
- Logs show: `RefreshToken model missing from PrismaClient`
- Logs show: `Prisma client missing basic models`

**Fix:**
- Add to build command: `pnpm db:generate`
- Or add to package.json scripts

### 3. Routes Not Registering
**Symptoms:**
- All `/api/*` endpoints return 404
- Root `/` endpoint works

**Possible Causes:**
- Database connection failed (routes don't register)
- Module initialization failed
- Build didn't include routes

**Fix:**
- Check database connection
- Check module imports in `app.module.ts`
- Verify build completed successfully

### 4. Port Not Set
**Symptoms:**
- Server not listening
- Connection refused

**Fix:**
- Set `PORT` environment variable
- Or ensure default (3001) is used

## Expected Startup Logs

When the API starts correctly, you should see:

```
═══════════════════════════════════════════════════════════
📝 main.ts LOADED
═══════════════════════════════════════════════════════════
🚀 BOOTSTRAP STARTED
[DEBUG] Hypothesis A: Checking Prisma client availability...
[DEBUG] Hypothesis B: About to initialize AppModule...
[DEBUG] Hypothesis C: Database connection will be tested...
[DEBUG] Hypothesis D: Error handler ready...
🔍 PRE-FLIGHT CHECK: Verifying Prisma Client
[1/4] Importing PrismaClient...
[2/4] Creating PrismaClient instance...
[3/4] Checking for models...
    ✓ user model: YES ✅
    ✓ product model: YES ✅
    ✓ refreshToken model: YES ✅
[4/4] ✅ Pre-flight check PASSED - All models found
✅ Server is listening on port 3001
✅ API server is running on: http://0.0.0.0:3001/api
✅ Health check available at: http://0.0.0.0:3001/api/health
✅ Root endpoint available at: http://0.0.0.0:3001/
```

## If Routes Still Don't Work

1. **Check if database is connected:**
   ```bash
   railway run pnpm db:push
   ```

2. **Check if Prisma client is generated:**
   ```bash
   railway run pnpm db:generate
   ```

3. **Redeploy the service:**
   ```bash
   railway up
   ```

4. **Check build logs:**
   - Go to Railway Dashboard → Deployments
   - Check the latest deployment build logs
   - Look for TypeScript errors or build failures

## Next Steps After Diagnosis

Once you've identified the issue:

1. **If database connection failed:**
   - Verify `DATABASE_URL` in Railway variables
   - Test database connection
   - Check database service status

2. **If Prisma client missing:**
   - Add `pnpm db:generate` to build command
   - Or add to package.json scripts

3. **If routes not registering:**
   - Check `app.module.ts` has all modules imported
   - Check controllers are registered
   - Verify build includes all files

4. **If build failed:**
   - Check build logs for errors
   - Verify all dependencies are installed
   - Check TypeScript compilation errors
