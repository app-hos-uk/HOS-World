# ✅ Frontend Variables Checklist - @hos-marketplace/web

## 📋 Required Variables for Frontend Service

**Service:** `@hos-marketplace/web`  
**Location:** Railway Dashboard → `@hos-marketplace/web` → Variables

---

## 🔑 Critical Variable: NEXT_PUBLIC_API_URL

### Current Issue:
- Frontend is trying to connect to `http://localhost:3001/api/auth/login`
- This causes CORS errors

### Required Value:
```
https://hos-marketplaceapi-production.up.railway.app/api
```

### How to Set:
1. Railway Dashboard → `@hos-marketplace/web` → **Variables** tab
2. Find `NEXT_PUBLIC_API_URL`
3. If it exists:
   - Click three-dot menu (⋮) → **Edit**
   - Update value to: `https://hos-marketplaceapi-production.up.railway.app/api`
   - Click **Save**
4. If it doesn't exist:
   - Click **"New Variable"** button
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://hos-marketplaceapi-production.up.railway.app/api`
   - Click **Save**

### ⚠️ Important:
- Must include `https://` protocol
- Must include `/api` path suffix
- No trailing slash after `/api`
- After updating, **MUST redeploy** the frontend service

---

## 📋 Complete Variable List

### Required Variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | `https://hos-marketplaceapi-production.up.railway.app/api` | Backend API endpoint |
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` (or leave empty) | Server port |

### Optional Variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `CMS_REVALIDATE_SECRET` | (your secret) | CMS revalidation |
| `NEXT_PUBLIC_CMS_URL` | (if using CMS) | CMS endpoint |

---

## ✅ Verification Steps

### Step 1: Check Variable Exists
1. Railway Dashboard → `@hos-marketplace/web` → Variables
2. Look for `NEXT_PUBLIC_API_URL`
3. Should be in the list

### Step 2: Verify Value
1. Click the **eye icon** (👁️) next to `NEXT_PUBLIC_API_URL`
2. Should reveal: `https://hos-marketplaceapi-production.up.railway.app/api`
3. **NOT:** `hos-marketplaceapi-production.up.railway.app` (missing protocol/path)
4. **NOT:** `http://localhost:3001/api` (wrong URL)

### Step 3: Update If Wrong
1. Click three-dot menu (⋮) → **Edit**
2. Set to: `https://hos-marketplaceapi-production.up.railway.app/api`
3. Click **Save**

### Step 4: Redeploy (CRITICAL)
1. Go to **Deployments** tab
2. Click **Redeploy** or **Deploy**
3. Wait 2-3 minutes
4. **Why?** Next.js bakes env vars into build - requires redeploy

---

## 🔍 Current Variables (From Screenshot)

Based on your screenshot, you have:
- ✅ `CMS_REVALIDATE_SECRET` - Present
- ✅ `NEXT_PUBLIC_API_URL` - Present (needs verification)
- ✅ `NODE_ENV` - Present
- ✅ `PORT` - Present

**Action Required:**
- Verify `NEXT_PUBLIC_API_URL` value is correct
- Update if needed
- Redeploy frontend

---

## 🧪 Test After Fix

### 1. Check Variable Value
- Railway Dashboard → Variables → Click eye icon on `NEXT_PUBLIC_API_URL`
- Should show: `https://hos-marketplaceapi-production.up.railway.app/api`

### 2. Verify Deployment
- Railway Dashboard → Deployments
- Latest deployment should be after variable update
- Status: "Active" or "Ready"

### 3. Test Frontend
- Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
- Open DevTools → Console
- Try login
- Should see: Requests to `https://hos-marketplaceapi-production.up.railway.app/api/auth/login`
- Should NOT see: `localhost:3001` errors

---

## 📝 Quick Reference

**Correct Value:**
```
https://hos-marketplaceapi-production.up.railway.app/api
```

**Incorrect Values:**
- ❌ `hos-marketplaceapi-production.up.railway.app` (missing protocol/path)
- ❌ `http://localhost:3001/api` (wrong URL)
- ❌ `https://hos-marketplaceapi-production.up.railway.app` (missing /api)

---

**Check the `NEXT_PUBLIC_API_URL` value and update if needed!**

