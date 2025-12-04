# 🚨 URGENT: Fix Frontend Localhost Issue

## ❌ Problem

**Code has fallback:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

**If `NEXT_PUBLIC_API_URL` is not set or empty, it uses `localhost:3001`!**

---

## ✅ Solution: Verify and Set Variable Correctly

### Step 1: Check Variable EXISTS

1. **Railway Dashboard** → `@hos-marketplace/web` → **Variables** tab
2. **Look for:** `NEXT_PUBLIC_API_URL`
3. **If it doesn't exist:**
   - Click **"New Variable"** button
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://hos-marketplaceapi-production.up.railway.app/api`
   - Click **Save**

### Step 2: Verify Variable Value

1. **Find:** `NEXT_PUBLIC_API_URL` in the list
2. **Click eye icon** to reveal value
3. **Must be EXACTLY:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
4. **Check:**
   - ✅ Starts with `https://`
   - ✅ Includes `/api` at the end
   - ✅ No spaces before or after
   - ✅ No quotes around the value

### Step 3: If Wrong, Update It

1. **Click three-dot menu (⋮)** → **Edit**
2. **Delete the old value completely**
3. **Type fresh:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
4. **Save**

### Step 4: Force Complete Rebuild

**CRITICAL:** Next.js bakes env vars into the build at BUILD TIME.

1. **Go to:** **Deployments** tab
2. **Click:** **"Redeploy"** button
3. **Watch build logs:**
   - Should see: `Installing dependencies...`
   - Should see: `Building application...`
   - Should see: `Compiling...`
   - Should see: `Ready in Xms`
4. **Wait:** 5-7 minutes for complete rebuild

**If you only see "Starting..." and "Ready in Xms" without build steps, it's just restarting, not rebuilding!**

---

## 🔍 Verify Variable is Set

**In Railway Variables tab, you should see:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://hos-marketplaceapi-production.up.railway.app/api` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or empty) |

**If `NEXT_PUBLIC_API_URL` is missing or wrong, that's the problem!**

---

## 🎯 Quick Fix Checklist

- [ ] Variable `NEXT_PUBLIC_API_URL` EXISTS in Variables tab
- [ ] Variable value = `https://hos-marketplaceapi-production.up.railway.app/api`
- [ ] No spaces in the value
- [ ] Variable saved successfully
- [ ] Triggered FULL REBUILD (not just restart)
- [ ] Build logs show compilation steps
- [ ] Waited 5-7 minutes
- [ ] Tested frontend login
- [ ] Console shows Railway URL (not localhost)

---

## 🆘 If Variable is Set But Still Using Localhost

### Check 1: Variable Name
- Must be exactly: `NEXT_PUBLIC_API_URL`
- Case-sensitive
- No typos
- No extra spaces

### Check 2: Build Actually Rebuilt
- Check build logs
- Should see "Building..." or "Compiling..."
- If only "Starting...", it didn't rebuild

### Check 3: Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear browser cache completely

---

## 📋 Exact Variable Configuration

**Variable Name:**
```
NEXT_PUBLIC_API_URL
```

**Variable Value:**
```
https://hos-marketplaceapi-production.up.railway.app/api
```

**No quotes, no spaces, exact match!**

---

**The variable MUST exist and have the correct value, then FULL REBUILD is required!**

