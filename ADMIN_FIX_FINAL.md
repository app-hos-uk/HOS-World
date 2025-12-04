# 🔧 Final Admin Fix - Two Issues Found

## ❌ Issue 1: Password Hash Missing `$2` Prefix

**Problem:** Password hash shows `b$10$...` but should be `$2b$10$...`

**Fix:** Update the password field in Railway Dashboard:

1. Go to Railway Dashboard → PostgreSQL → Data → users table
2. Click on the user row with `app@houseofspells.co.uk`
3. Click **Edit**
4. In the **password** field, replace with this EXACT value:

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**Important:**
- Must start with `$2b$` (not `b$`)
- Must be exactly 60 characters
- No spaces before or after

5. Click **Save**

---

## ❌ Issue 2: Frontend Using Localhost Instead of Railway API

**Problem:** Frontend is trying to connect to `http://localhost:3001/api/auth/login` instead of Railway API URL.

**Error in Console:**
```
Access to fetch at 'http://localhost:3001/api/auth/login' from origin 'https://hos-marketplaceweb-production.up.railway.app' has been blocked by CORS policy
```

**Fix:** Update Frontend Environment Variable

1. Go to Railway Dashboard
2. Select **`@hos-marketplace/web`** service (frontend)
3. Go to **Variables** tab
4. Find `NEXT_PUBLIC_API_URL` or `API_URL` variable
5. Update it to:
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
   (NOT `http://localhost:3001/api`)

6. **Redeploy** the frontend service

---

## ✅ Complete Fix Steps

### Step 1: Fix Password Hash in Database

1. Railway Dashboard → PostgreSQL → Data → users
2. Edit user: `app@houseofspells.co.uk`
3. Update password field to:
   ```
   $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
   ```
4. Save

### Step 2: Fix Frontend API URL

1. Railway Dashboard → `@hos-marketplace/web` service
2. Variables tab
3. Update `NEXT_PUBLIC_API_URL` to:
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
4. Redeploy frontend service

### Step 3: Restart API Service (If Not Done)

1. Railway Dashboard → `@hos-marketplace/api` service
2. Deployments tab
3. Redeploy

### Step 4: Test

**Via API (should work now):**
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

**Via Frontend (should work after Step 2):**
- Go to: https://hos-marketplaceweb-production.up.railway.app/login
- Login should work without CORS errors

---

## 🔑 Correct Password Hash

**Copy this EXACTLY (no spaces):**
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**Verification:**
- Starts with: `$2b$10$` ✅
- Length: 60 characters ✅
- No spaces ✅

---

## 📋 Frontend Environment Variables

**Required Variable:**
```
NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api
```

**Check these variables in frontend service:**
- `NEXT_PUBLIC_API_URL`
- `API_URL`
- `REACT_APP_API_URL` (if using React)
- Any variable that contains `localhost:3001`

All should point to: `https://hos-marketplaceapi-production.up.railway.app/api`

---

## ✅ After Fixes

1. **Password hash fixed** → API login will work
2. **Frontend API URL fixed** → Frontend login will work
3. **No more CORS errors** → Frontend can connect to API

---

**Fix both issues and login will work!**

