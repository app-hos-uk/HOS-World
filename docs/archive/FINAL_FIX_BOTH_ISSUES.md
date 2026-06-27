# 🔧 Final Fix - Both Issues

## ❌ Issue 1: Frontend Still Using Localhost

**Problem:** Frontend is still trying `http://localhost:3001/api/auth/login`

**This means:**
- Variable wasn't updated correctly, OR
- Frontend wasn't rebuilt after variable change

**Fix:**

### Step 1: Verify Variable Value
1. Railway Dashboard → `@hos-marketplace/web` → **Variables**
2. Find `NEXT_PUBLIC_API_URL`
3. Click **eye icon** to reveal value
4. **Must be exactly:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```

### Step 2: If Wrong, Update It
1. Click three-dot menu (⋮) → **Edit**
2. Set to: `https://hos-marketplaceapi-production.up.railway.app/api`
3. **Save**

### Step 3: Force Rebuild
1. Go to **Deployments** tab
2. Click **"Redeploy"** (not just restart)
3. **Wait for full rebuild** (3-5 minutes)
4. Check build logs to ensure it's rebuilding, not just restarting

**Important:** Next.js bakes env vars into the build. You need a FULL REBUILD, not just a restart.

---

## ❌ Issue 2: API Login Still 401

**Problem:** Password hash comparison failing

**Solution: Create Fresh User with Fresh Hash**

### Step 1: Delete Existing User
1. Railway Dashboard → PostgreSQL → Data → users
2. Find user: `app@houseofspells.co.uk`
3. Click row → Click **trash icon** → Delete

### Step 2: Generate Fresh Password Hash

**Option A: Use Online Tool**
1. Go to: https://bcrypt-generator.com/
2. Rounds: `10`
3. Password: ``$SEED_ADMIN_PASSWORD` (env)`
4. Click "Generate"
5. Copy the hash

**Option B: Use Node.js (if available)**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('`$SEED_ADMIN_PASSWORD` (env)', 10).then(hash => console.log(hash));"
```

### Step 3: Create New User with Fresh Hash
1. Railway Dashboard → PostgreSQL → Data → users
2. Click **"+ Row"**
3. Fill in:

| Field | Value |
|-------|-------|
| **id** | `be47307a-2afc-4d83-b44a-ba473f09458b` (or generate new UUID) |
| **email** | `app@houseofspells.co.uk` |
| **password** | `[FRESH_HASH_FROM_STEP_2]` |
| **firstName** | `Super` |
| **lastName** | `Admin` |
| **role** | `ADMIN` |
| **phone** | (leave empty) |
| **avatar** | (leave empty) |
| **createdAt** | `2025-12-04 08:00:00.000` (current timestamp) |
| **updatedAt** | `2025-12-04 08:00:00.000` (same as createdAt) |
| **loyaltyPoints** | `0` |
| **themePreference** | (leave empty) |
| **cartId** | (leave empty) |

4. **Save**

### Step 4: Restart API Service
1. Railway Dashboard → `@hos-marketplace/api` → Deployments
2. Click **Redeploy**
3. Wait 2-3 minutes

### Step 5: Test Login
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "`$SEED_ADMIN_PASSWORD` (env)"}'
```

---

## 🎯 Complete Action Plan

### For Frontend (Issue 1):
1. ✅ Verify `NEXT_PUBLIC_API_URL` = `https://hos-marketplaceapi-production.up.railway.app/api`
2. ✅ Update if wrong
3. ✅ **FULL REDEPLOY** (not just restart)
4. ✅ Wait for rebuild to complete
5. ✅ Test frontend login

### For API (Issue 2):
1. ✅ Delete existing user
2. ✅ Generate fresh password hash
3. ✅ Create new user with fresh hash
4. ✅ Restart API service
5. ✅ Test API login

---

## 🔍 Why Frontend Still Uses Localhost

**Possible reasons:**
1. Variable value is wrong (missing `https://` or `/api`)
2. Frontend wasn't rebuilt (just restarted)
3. Next.js cached the old value
4. Build used old environment variables

**Solution:** 
- Verify variable value is EXACTLY correct
- Do a FULL REDEPLOY (not restart)
- Check build logs to confirm it's rebuilding

---

## 🔍 Why API Login Fails

**Possible reasons:**
1. Password hash has hidden characters
2. Hash format is wrong
3. Hash was truncated
4. Bcrypt version mismatch

**Solution:**
- Delete user completely
- Generate FRESH hash
- Create new user with fresh hash
- Restart API

---

## ✅ After Both Fixes

1. **Frontend:** Should connect to Railway API (no localhost)
2. **API:** Should accept login (no 401)
3. **Both:** Should work together

---

**Fix both issues and everything should work!**

