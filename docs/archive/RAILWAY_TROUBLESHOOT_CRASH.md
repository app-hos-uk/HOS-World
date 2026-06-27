# 🔍 Troubleshoot Service Crash - Railway

## Current Status
✅ Environment variables are set  
❌ Service is crashing  

## 🔍 Step 1: Check Deploy Logs

1. Go to Railway Dashboard
2. Click `@hos-marketplace/api` service
3. Go to **"Deployments"** tab
4. Click on the **latest deployment** (the one that crashed)
5. Go to **"Deploy Logs"** tab
6. **Scroll to the bottom** - look for error messages

**Common errors to look for:**
- `DATABASE_URL is required`
- `Connection refused`
- `PrismaClientInitializationError`
- `Port already in use`
- `Cannot find module`
- `EADDRINUSE`

---

## 🔧 Step 2: Verify All Required Variables

Make sure these are set in `@hos-marketplace/api` → Variables tab:

### Required (Must Have):
- [ ] `DATABASE_URL` ✅ (you have this)
- [ ] `REDIS_URL` ✅ (you have this)
- [ ] `PORT=3001` ⚠️ **Check this!**
- [ ] `NODE_ENV=production` ⚠️ **Check this!**
- [ ] `JWT_SECRET` ✅ (you have this)
- [ ] `JWT_REFRESH_SECRET` ✅ (you have this)
- [ ] `JWT_EXPIRES_IN=7d` ✅ (you have this)
- [ ] `JWT_REFRESH_EXPIRES_IN=30d` ✅ (you have this)
- [ ] `FRONTEND_URL` ⚠️ **Check this!** (can be placeholder for now)

---

## 🐛 Common Crash Causes

### 1. Missing PORT or NODE_ENV
**Error:** Service starts but crashes immediately  
**Fix:** Add `PORT=3001` and `NODE_ENV=production`

### 2. Database Connection Failed
**Error:** `PrismaClientInitializationError` or `Connection refused`  
**Fix:** 
- Verify DATABASE_URL is correct (copy entire value)
- Check PostgreSQL service is running (green status)
- Ensure URL format is correct

### 3. Redis Connection Failed
**Error:** `Redis connection failed`  
**Fix:**
- Verify REDIS_URL is correct
- Check Redis service is running
- App should still start even if Redis fails (it has fallback)

### 4. Module Not Found
**Error:** `Cannot find module '@nestjs/core'`  
**Fix:** Already fixed in Dockerfile - should not occur

### 5. Port Already in Use
**Error:** `EADDRINUSE` or `Port already in use`  
**Fix:** Railway auto-assigns ports, but ensure `PORT=3001` is set

---

## ✅ Quick Fix Checklist

1. **Add Missing Variables:**
   ```
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://placeholder.railway.app
   ```

2. **Verify Database Connection:**
   - PostgreSQL service shows green status
   - DATABASE_URL is the full connection string
   - No typos in the URL

3. **Check Deploy Logs:**
   - Look for the actual error message
   - Share the error if you need help

4. **Wait for Redeploy:**
   - Railway auto-redeploys when you add variables
   - Watch Deploy Logs for progress

---

## 📋 What to Share for Help

If the service is still crashing, share:
1. **Error message** from Deploy Logs (last 20-30 lines)
2. **List of variables** you've added
3. **Service status** (crashed, failed, etc.)

---

## 🎯 Expected Success Indicators

When service starts successfully, you'll see:
- ✅ Service status: **"Active"** (green)
- ✅ Deploy Logs show: `🚀 API server is running on: http://localhost:3001/api`
- ✅ Healthcheck passes (if enabled)
- ✅ Can access: `https://your-backend-url.railway.app/api/health`

---

**Next Step:** Check Deploy Logs and add any missing variables (especially `PORT` and `NODE_ENV`)!

