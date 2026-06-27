# 🔧 Fix CORS 502 Error - Backend Service Not Responding

## ❌ Problem

**Error Messages:**
```
Access to fetch at 'https://hos-marketplaceapi-production.up.railway.app/api/...' 
from origin 'https://hos-marketplaceweb-production.up.railway.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Network Tab Shows:**
- `502` status for preflight (OPTIONS) requests
- `CORS error` for actual requests
- `net::ERR_FAILED` errors

**Root Cause:** The backend API service is either:
1. **Not running** (crashed or stopped)
2. **Not responding** to requests
3. **Failing to start** due to configuration errors

---

## ✅ Solution Steps

### Step 1: Check Backend Service Status in Railway

1. **Go to Railway Dashboard**
2. **Select:** `@hos-marketplace/api` service (backend API)
3. **Check:**
   - ✅ Service status should be "Running" (green)
   - ✅ Check "Deployments" tab for latest deployment status
   - ✅ Check "Metrics" tab for CPU/Memory usage

**If service shows as "Stopped" or "Error":**
- Click **"Redeploy"** button
- Or click **"Restart"** button

---

### Step 2: Check Railway Logs

1. **In Railway Dashboard** → `@hos-marketplace/api` service
2. **Click:** **"Logs"** tab
3. **Look for:**
   - ❌ Error messages
   - ❌ "Failed to start API server"
   - ❌ Database connection errors
   - ❌ Missing environment variables
   - ✅ "Server is listening on port XXXX" (success message)

**Common Errors to Look For:**
```
❌ Failed to start API server
❌ Error: connect ECONNREFUSED (database connection)
❌ Missing required environment variable: DATABASE_URL
❌ Prisma migration failed
```

---

### Step 3: Verify Critical Environment Variables

**In Railway Dashboard** → `@hos-marketplace/api` → **Variables** tab:

**Required Variables:**
- ✅ `DATABASE_URL` - Must be set and valid
- ✅ `PORT` - Should be set (Railway usually sets this automatically)
- ✅ `NODE_ENV` - Should be `production`
- ✅ `FRONTEND_URL` - Should be `https://hos-marketplaceweb-production.up.railway.app`
- ✅ `JWT_SECRET` - Must be set for authentication
- ✅ Any other required variables for your services

**To Fix:**
1. Click on variable name
2. Click **"Edit"**
3. Update value
4. **Save**
5. Service will auto-restart

---

### Step 4: Test Backend Health Endpoint

**Try accessing the health endpoint directly:**

```bash
curl https://hos-marketplaceapi-production.up.railway.app/api/health
```

**Or in browser:**
```
https://hos-marketplaceapi-production.up.railway.app/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": "..."
}
```

**If you get:**
- ❌ `502 Bad Gateway` → Service is down
- ❌ `503 Service Unavailable` → Service is starting/crashing
- ❌ `Connection refused` → Service is not running
- ✅ `200 OK` with JSON → Service is running!

---

### Step 5: Check Database Connection

**If logs show database errors:**

1. **Verify `DATABASE_URL` in Railway:**
   - Should start with `postgresql://` or `postgres://`
   - Should include credentials, host, port, and database name
   - Should be from Railway PostgreSQL service

2. **Test database connection:**
   - Go to Railway PostgreSQL service
   - Check if it's running
   - Verify connection string is correct

---

### Step 6: Redeploy Backend Service

**If service is not responding:**

1. **In Railway Dashboard** → `@hos-marketplace/api`
2. **Go to:** **Deployments** tab
3. **Click:** **"Redeploy"** button
4. **Wait:** 3-5 minutes for deployment
5. **Monitor:** Logs tab for startup messages

**Look for these success messages:**
```
✅ Server is listening on port XXXX
✅ API server is running on: http://0.0.0.0:XXXX/api
✅ Health check available at: http://0.0.0.0:XXXX/api/health
🌐 CORS allowed origins: [...]
```

---

### Step 7: Verify CORS Configuration

**After service is running, check logs for:**
```
🌐 CORS allowed origins: [
  'https://hos-marketplaceweb-production.up.railway.app',
  'http://localhost:3000',
  ...
]
```

**If frontend origin is NOT in the list:**
- Update `FRONTEND_URL` environment variable
- Restart service

---

## 🔍 Code Changes Made

I've updated `services/api/src/main.ts` to:

1. **Enhanced CORS configuration:**
   - Added explicit OPTIONS request handler
   - Better preflight request handling
   - More comprehensive allowed headers

2. **Improved error logging:**
   - Better CORS origin logging
   - Clearer error messages

3. **Explicit preflight handling:**
   - Dedicated middleware for OPTIONS requests
   - Ensures preflight requests are handled even if service has issues

---

## ✅ Verification Checklist

After fixing, verify:

- [ ] Backend service shows "Running" in Railway
- [ ] Health endpoint returns `200 OK`: `/api/health`
- [ ] Logs show "Server is listening on port XXXX"
- [ ] Logs show CORS allowed origins include frontend URL
- [ ] No errors in Railway logs
- [ ] Frontend can make API requests without CORS errors
- [ ] Login works without "Failed to fetch" errors

---

## 🚨 If Still Not Working

**If backend is running but still getting CORS errors:**

1. **Check Railway service URL:**
   - Verify `@hos-marketplace/api` service URL matches what frontend is using
   - Check if there are multiple API services

2. **Check Railway proxy/gateway:**
   - Railway might have routing issues
   - Try accessing API directly via Railway-assigned URL

3. **Check frontend API URL:**
   - Verify `NEXT_PUBLIC_API_URL` in frontend service
   - Should be: `https://hos-marketplaceapi-production.up.railway.app/api`
   - Must include `/api` at the end

4. **Clear browser cache:**
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Or use incognito/private window

---

## 📝 Next Steps

Once backend is running:

1. **Test login** at: `https://hos-marketplaceweb-production.up.railway.app/login`
2. **Check browser console** - should see no CORS errors
3. **Check Network tab** - requests should return `200 OK`
4. **Proceed with migration** as admin user

---

**Status:** 🟡 Waiting for backend service to be running → 🟢 Ready to test login

