# 🔧 Fix Frontend API URL - Missing Protocol and Path

## ❌ Current Issue

**Frontend is still using:** `http://localhost:3001/api/auth/login`

**Error:**
```
Access to fetch at 'http://localhost:3001/api/auth/login' from origin 'https://hos-marketplaceweb-production.up.railway.app' has been blocked by CORS policy
```

## ✅ Problem Found

The `NEXT_PUBLIC_API_URL` variable is set to:
```
hos-marketplaceapi-production.up.railway.app
```

**But it should be:**
```
https://hos-marketplaceapi-production.up.railway.app/api
```

**Missing:**
- ❌ `https://` protocol prefix
- ❌ `/api` path suffix

---

## 🔧 Fix Steps

### Step 1: Update the Variable

1. **Go to Railway Dashboard**
2. **Select:** `@hos-marketplace/web` service
3. **Go to:** **Variables** tab
4. **Find:** `NEXT_PUBLIC_API_URL`
5. **Click:** Three-dot menu (⋮) next to the variable
6. **Click:** **Edit**
7. **Set value to:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
   **Important:**
   - Must include `https://` at the start
   - Must include `/api` at the end
   - No trailing slash after `/api`

8. **Click:** **Save**

### Step 2: Redeploy Frontend Service

**IMPORTANT:** After updating the variable, you MUST redeploy:

1. **Go to:** **Deployments** tab
2. **Click:** **Redeploy** or **Deploy**
3. **Wait:** 2-3 minutes for deployment to complete

**Why?** Next.js environment variables are baked into the build at build time. Changing the variable requires a rebuild/redeploy.

### Step 3: Verify

After redeployment:

1. **Go to:** Frontend URL: `https://hos-marketplaceweb-production.up.railway.app/login`
2. **Open:** Browser DevTools → Console
3. **Try to login**
4. **Check:** Should see API calls to `https://hos-marketplaceapi-production.up.railway.app/api/auth/login`
5. **No more:** `localhost:3001` errors

---

## ✅ Correct Variable Value

**Variable Name:** `NEXT_PUBLIC_API_URL`  
**Variable Value:**
```
https://hos-marketplaceapi-production.up.railway.app/api
```

**Breakdown:**
- `https://` - Protocol (required)
- `hos-marketplaceapi-production.up.railway.app` - Domain
- `/api` - API path (required)

---

## 🔍 Verify After Fix

### Check 1: Variable Value
- Railway Dashboard → `@hos-marketplace/web` → Variables
- Click eye icon on `NEXT_PUBLIC_API_URL`
- Should show: `https://hos-marketplaceapi-production.up.railway.app/api`

### Check 2: Frontend Redeployed
- Railway Dashboard → `@hos-marketplace/web` → Deployments
- Latest deployment should be after you updated the variable
- Status should be "Active" or "Ready"

### Check 3: Browser Console
- Open frontend login page
- Open DevTools → Console
- Try login
- Should see requests to: `https://hos-marketplaceapi-production.up.railway.app/api/auth/login`
- Should NOT see: `localhost:3001`

---

## 📋 Complete Variable Configuration

**For `@hos-marketplace/web` service:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://hos-marketplaceapi-production.up.railway.app/api` |
| `NODE_ENV` | `production` |
| `PORT` | (leave empty or `3000`) |

---

## ⚠️ Important Notes

1. **Must include `https://`** - Without it, browser will try `http://` or fail
2. **Must include `/api`** - This is the API base path
3. **Must redeploy** - Environment variables are baked into Next.js build
4. **No trailing slash** - Don't add `/` after `/api`

---

## 🧪 After Fix - Test Login

**Via Frontend:**
1. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
2. Enter:
   - Email: `app@houseofspells.co.uk`
   - Password: `Admin123`
3. Click Login
4. Should work without CORS errors!

**Via API (should already work):**
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

---

**Update the variable with `https://` and `/api`, then redeploy the frontend!**

