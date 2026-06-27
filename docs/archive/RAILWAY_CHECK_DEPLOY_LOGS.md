# 🔍 Check Deploy Logs - Service Not Starting

## ✅ Build Status: SUCCESS
The Docker build completed successfully in 20 seconds!

## ❌ Service Status: NOT STARTING
Healthcheck is failing - service isn't responding at `/api/health`

---

## 🔍 Step 1: Check Deploy Logs (CRITICAL)

The deploy logs will show **why** the service isn't starting.

### How to Check:

1. Railway Dashboard → `@hos-marketplace/api` service
2. Click **"Deployments"** tab
3. Click on the **latest deployment** (the one that just built)
4. Click **"Deploy Logs"** tab (NOT Build Logs)
5. **Scroll to the bottom** - look for error messages

**What to look for:**
- Error messages in red
- Stack traces
- Connection errors
- Module not found errors
- Port errors
- Database connection errors

---

## 🐛 Common Issues After Adding Variables

### Issue 1: Database Connection Error
**Error:** `PrismaClientInitializationError` or `Can't reach database server`

**Symptoms:**
- Service starts but crashes immediately
- Error mentions DATABASE_URL or Prisma

**Fix:**
- Verify DATABASE_URL is correct (copy entire value from PostgreSQL service)
- Check PostgreSQL service is running (green status)
- Ensure URL format is: `postgresql://postgres:password@host:port/database`

### Issue 2: Application Startup Error
**Error:** `Cannot find module` or `Error: ...`

**Symptoms:**
- Service crashes on startup
- Module/import errors

**Fix:**
- Already fixed in Dockerfile
- If persists, check Deploy Logs for specific module

### Issue 3: Port Configuration Issue
**Error:** `EADDRINUSE` or `Port already in use`

**Symptoms:**
- Service can't bind to port

**Fix:**
- Ensure `PORT=3001` is set
- Railway auto-assigns ports, but PORT variable is still needed

### Issue 4: Missing Environment Variable
**Error:** `... is required` or `undefined`

**Symptoms:**
- Application expects a variable that's not set

**Fix:**
- Check Deploy Logs for which variable is missing
- Add it to Variables tab

---

## 📋 Quick Verification Checklist

Before checking logs, verify:

- [ ] `PORT=3001` is in Variables tab
- [ ] `NODE_ENV=production` is in Variables tab
- [ ] `DATABASE_URL` is correct (entire value copied)
- [ ] `REDIS_URL` is correct (entire value copied)
- [ ] All JWT secrets are set
- [ ] PostgreSQL service is running (green)
- [ ] Redis service is running (green)

---

## 🎯 What to Share for Help

If service is still not starting, share:

1. **Last 20-30 lines of Deploy Logs** (from Deploy Logs tab, not Build Logs)
2. **List of all variables** you've added
3. **Any error messages** you see

---

## ✅ Expected Success in Deploy Logs

When service starts successfully, you'll see:
```
🚀 API server is running on: http://localhost:3001/api
```

If you see this, the service is running and healthcheck should pass!

---

## 🔧 Quick Fixes to Try

### Fix 1: Verify All Variables
Double-check Variables tab has:
- PORT=3001
- NODE_ENV=production
- DATABASE_URL (full value)
- REDIS_URL (full value)
- All JWT variables

### Fix 2: Check Database Connection
- PostgreSQL service → Variables tab
- Copy DATABASE_URL again
- Paste into backend API Variables tab
- Make sure no extra spaces or characters

### Fix 3: Restart Service
- Sometimes a manual restart helps
- Go to Deployments tab
- Click "..." menu on latest deployment
- Select "Redeploy"

---

**Next Step: Check Deploy Logs and share the error message!**

