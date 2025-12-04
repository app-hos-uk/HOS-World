# 🔧 Fix Frontend Still Using Localhost

## ❌ Problem: Frontend Still Using `localhost:3001`

**Error in Console:**
```
Access to fetch at 'http://localhost:3001/api/auth/login' from origin 'https://hos-marketplaceweb-production.up.railway.app' has been blocked by CORS policy
```

**This means:** The `NEXT_PUBLIC_API_URL` variable is either:
1. Not set correctly
2. Not being read by the build
3. The build is using a cached/old value

---

## ✅ Solution: Force Complete Rebuild

### Step 1: Verify Variable Value

1. **Railway Dashboard** → `@hos-marketplace/web` → **Variables** tab
2. **Find:** `NEXT_PUBLIC_API_URL`
3. **Click eye icon** to reveal value
4. **Must be EXACTLY:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
5. **Check for:**
   - ✅ Starts with `https://`
   - ✅ Includes `/api` at the end
   - ✅ No trailing slash
   - ✅ No spaces

### Step 2: If Wrong, Update It

1. **Click three-dot menu (⋮)** → **Edit**
2. **Set value to:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```
3. **Save**

### Step 3: Force Complete Rebuild

**Important:** Next.js bakes environment variables into the build. You need a FULL REBUILD:

1. **Go to:** **Deployments** tab
2. **Click:** **"Redeploy"** button
3. **OR:** Delete the latest deployment and create a new one
4. **Wait:** 5-7 minutes for complete rebuild
5. **Check build logs** to ensure it's rebuilding (not just restarting)

**Look for in build logs:**
- `Installing dependencies...`
- `Building application...`
- `Compiling...`
- `Ready in Xms`

**NOT just:**
- `Starting...`
- `Ready in Xms` (without build steps)

---

## 🔍 Alternative: Check Code for Hardcoded Value

The code might have a hardcoded fallback. Check:

**File:** `apps/web/src/lib/api.ts`

**Should have:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

**If variable is not set, it falls back to localhost!**

**Solution:** Make sure the variable is set in Railway.

---

## 🎯 Complete Fix Steps

### Option 1: Update Variable and Rebuild (Recommended)

1. ✅ Verify `NEXT_PUBLIC_API_URL` = `https://hos-marketplaceapi-production.up.railway.app/api`
2. ✅ Update if wrong
3. ✅ Go to Deployments → **Redeploy**
4. ✅ Wait for FULL rebuild (5-7 minutes)
5. ✅ Test frontend login

### Option 2: Delete and Redeploy

1. **Go to:** Deployments tab
2. **Delete** the latest deployment
3. **Trigger new deployment** (Railway will auto-deploy)
4. **Wait** for complete build
5. **Test**

---

## 🔍 Verify After Rebuild

1. **Go to:** `https://hos-marketplaceweb-production.up.railway.app/login`
2. **Open DevTools** → Console
3. **Try login**
4. **Check console:**
   - ✅ Should see: `https://hos-marketplaceapi-production.up.railway.app/api/auth/login`
   - ❌ Should NOT see: `http://localhost:3001/api/auth/login`

---

## 📋 Checklist

- [ ] Variable `NEXT_PUBLIC_API_URL` exists
- [ ] Variable value = `https://hos-marketplaceapi-production.up.railway.app/api`
- [ ] Variable has no extra spaces
- [ ] Full rebuild triggered (not just restart)
- [ ] Build logs show compilation steps
- [ ] Waited 5-7 minutes for rebuild
- [ ] Tested frontend login
- [ ] Console shows Railway URL (not localhost)

---

## 🆘 If Still Not Working

### Check 1: Variable Name
- Must be exactly: `NEXT_PUBLIC_API_URL`
- Case-sensitive
- No typos

### Check 2: Build Logs
- Should show "Building..." or "Compiling..."
- Not just "Starting..."

### Check 3: Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`
- Or clear cache completely

### Check 4: Check Code
- Look for hardcoded `localhost:3001` in code
- Check `apps/web/src/lib/api.ts`

---

**The variable must be set correctly AND the frontend must be fully rebuilt!**

