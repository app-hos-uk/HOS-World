# 🚨 URGENT: Backend Service is Down - 502 Error

## ❌ Current Status

**Backend API is NOT running!**

**Test Result:**
```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/health
# Returns: {"status":"error","code":502,"message":"Application failed to respond"}
```

**This means:**
- ✅ Railway's proxy is working
- ❌ Your backend service is **NOT running** or **crashing on startup**
- ❌ The CORS code fixes can't help until the service is running

---

## 🔧 IMMEDIATE ACTION REQUIRED

### Step 1: Check Railway Service Status

1. **Go to Railway Dashboard:** https://railway.app
2. **Select:** `@hos-marketplace/api` service (backend API)
3. **Check the status:**
   - ❌ **"Stopped"** → Service is down
   - ❌ **"Error"** → Service crashed
   - ❌ **"Crashing"** → Service keeps restarting and failing
   - ✅ **"Active"** or **"Running"** → Service should be working (but might have issues)

### Step 2: Check Deploy Logs (CRITICAL)

1. **In Railway** → `@hos-marketplace/api` service
2. **Click:** **"Deployments"** tab
3. **Click:** **Latest deployment** (most recent one)
4. **Click:** **"Deploy Logs"** tab (NOT Build Logs)
5. **Scroll to the bottom** and look for:

**✅ Success Messages:**
```
🚀 Starting API server...
🌐 CORS allowed origins: [...]
✅ Server is listening on port XXXX
✅ API server is running on: http://0.0.0.0:XXXX/api
```

**❌ Error Messages (Common Issues):**
```
❌ Failed to start API server
Error: connect ECONNREFUSED (database connection failed)
Missing required environment variable: DATABASE_URL
PrismaClientInitializationError: Can't reach database server
Error: Port already in use
Module not found: ...
```

### Step 3: Check Environment Variables

**Go to Railway** → `@hos-marketplace/api` → **"Variables"** tab

**CRITICAL Variables Required:**

```env
# Database (MUST BE SET - Get from PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@host:port/database

# Server Configuration
PORT=3001
NODE_ENV=production

# Frontend URL (for CORS)
FRONTEND_URL=https://hos-marketplaceweb-production.up.railway.app

# JWT Secrets (Required for authentication)
JWT_SECRET=[generate with: openssl rand -base64 32]
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=[generate with: openssl rand -base64 32]
JWT_REFRESH_EXPIRES_IN=30d
```

**How to Get DATABASE_URL:**
1. Railway Dashboard → **PostgreSQL** service
2. **Variables** tab
3. Find `DATABASE_URL`
4. **Copy the ENTIRE value** (it's very long!)
5. Paste into backend API service variables

**If DATABASE_URL is missing or wrong:**
- Service will crash immediately on startup
- You'll see connection errors in logs

### Step 4: Check for Crash Loops

**If service shows "Crashing" or keeps restarting:**

1. **Check Deploy Logs** for the error pattern
2. **Common causes:**
   - Missing `DATABASE_URL` → Add it from PostgreSQL service
   - Wrong `DATABASE_URL` format → Verify it's complete
   - Database not accessible → Check PostgreSQL service is running
   - Missing `JWT_SECRET` → Generate and add it
   - Port conflict → Railway handles this, but check `PORT` variable

### Step 5: Redeploy Service

**After fixing environment variables:**

1. **In Railway** → `@hos-marketplace/api`
2. **Deployments** tab
3. **Click:** **"Redeploy"** button
4. **Wait:** 3-5 minutes for deployment
5. **Monitor:** Deploy Logs tab for startup messages

**Watch for:**
- ✅ "Server is listening on port XXXX"
- ✅ "API server is running"
- ❌ Any error messages

---

## 🔍 Diagnostic Commands

**Test if backend is running:**
```bash
# Should return 200 OK with JSON, not 502
curl https://hos-marketplaceapi-production.up.railway.app/api/health
```

**Expected Success Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "service": "House of Spells Marketplace API"
}
```

**Current Response (Service Down):**
```json
{
  "status": "error",
  "code": 502,
  "message": "Application failed to respond"
}
```

---

## 📋 Quick Fix Checklist

- [ ] Check Railway → `@hos-marketplace/api` service status
- [ ] Check Deploy Logs for error messages
- [ ] Verify `DATABASE_URL` is set (get from PostgreSQL service)
- [ ] Verify `FRONTEND_URL` is set to: `https://hos-marketplaceweb-production.up.railway.app`
- [ ] Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- [ ] Verify `PORT=3001` is set
- [ ] Verify `NODE_ENV=production` is set
- [ ] Redeploy service after fixing variables
- [ ] Test health endpoint: `/api/health` should return 200 OK
- [ ] Once health endpoint works, test login

---

## 🎯 Once Backend is Running

**After the service starts successfully:**

1. **Test health endpoint:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api/health
   ```
   Should return `200 OK` with JSON

2. **Test preflight request:**
   - Open browser console on frontend
   - Try to login
   - Should see CORS headers in Network tab
   - No more "Failed to fetch" errors

3. **The CORS fixes I made will work once the service is running:**
   - Early OPTIONS handler
   - Enhanced CORS configuration
   - Safety net middleware

---

## 🚨 Most Common Issue: Missing DATABASE_URL

**If you see this in logs:**
```
Error: connect ECONNREFUSED
PrismaClientInitializationError
Can't reach database server
```

**Fix:**
1. Railway → PostgreSQL service → Variables tab
2. Copy `DATABASE_URL` value
3. Railway → Backend API service → Variables tab
4. Add/Update `DATABASE_URL` with the copied value
5. Redeploy backend service

---

## 📝 Summary

**Current Problem:** Backend service is down (502 error)

**Root Cause:** Service is not running or crashing on startup

**Solution:** 
1. Check Railway service status and logs
2. Fix missing/wrong environment variables (especially `DATABASE_URL`)
3. Redeploy service
4. Verify health endpoint works
5. Then test login

**Status:** 🟥 Backend Down → 🟡 Fix Environment Variables → 🟡 Redeploy → 🟢 Test

---

**The CORS code fixes are ready and will work once the backend service is running!**

