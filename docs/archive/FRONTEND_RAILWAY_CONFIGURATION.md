# Frontend Service Configuration Guide (@hos-marketplace/web)

Based on your Railway dashboard screenshots, here are the **exact configurations** you need:

## 🔧 Required Configuration Changes

### 1. **Deploy Tab → Custom Start Command**

**Current (WRONG):**
```
pnpm --filter @hos-marketplace/web start
```

**Should be:**
```
(Leave EMPTY - Dockerfile handles this)
```

**Why:** Your Dockerfile already has `CMD ["pnpm", "start"]` which runs from the correct directory. The custom start command is overriding it and may cause issues.

**Action:** Delete/clear the Custom Start Command field.

---

### 2. **Deploy Tab → Healthcheck Path**

**Current:** Not configured

**Should be:**
```
/
```

**Or:** Leave it disabled (empty) if you prefer.

**Why:** Next.js serves on `/` by default. A healthcheck ensures the deployment is ready before traffic is routed to it.

**Action:** Click "+ Healthcheck Path" and enter `/`

---

### 3. **Deploy Tab → Serverless**

**Current:** Disabled (OFF)

**Recommendation:** Keep it **DISABLED** (OFF)

**Why:** Next.js needs to stay running for optimal performance. Serverless mode can cause cold starts.

**Action:** No change needed - keep it OFF.

---

### 4. **Deploy Tab → Restart Policy**

**Current:** Configured in `railway.toml` (On Failure, 10 retries)

**Status:** ✅ **CORRECT** - No changes needed

Your `railway.toml` already has:
```toml
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Action:** No change needed.

---

### 5. **Build Tab** (Not shown, but verify)

**Root Directory:** Should be `apps/web`
**Dockerfile Path:** Should be `apps/web/Dockerfile`
**Build Command:** Should be **empty** (Dockerfile handles it)

---

### 6. **Source Tab** (Not shown, but verify)

**Repository:** Should be connected to `app-hos-uk/HOS-World`
**Branch:** Should be `master` (or your main branch)

---

## 📋 Configuration Summary

### ✅ Correct Settings:

| Setting | Value | Status |
|---------|-------|--------|
| **Root Directory** | `apps/web` | ✅ Verify |
| **Dockerfile Path** | `apps/web/Dockerfile` | ✅ Verify |
| **Build Command** | (empty) | ✅ Verify |
| **Start Command** | (empty) | ❌ **FIX: Remove current command** |
| **Healthcheck Path** | `/` | ❌ **FIX: Add this** |
| **Serverless** | Disabled (OFF) | ✅ Correct |
| **Restart Policy** | On Failure, 10 retries | ✅ Correct (in railway.toml) |
| **Region** | US West (or your preference) | ✅ Correct |
| **Instances** | 1 | ✅ Correct |

---

## 🚨 Critical Fixes Needed

### Fix #1: Remove Custom Start Command

1. Go to **Deploy** tab
2. Find **"Custom Start Command"** section
3. **Delete/clear** the command: `pnpm --filter @hos-marketplace/web start`
4. Leave it **empty**
5. Save changes

### Fix #2: Add Healthcheck Path

1. Go to **Deploy** tab
2. Find **"Healthcheck Path"** section
3. Click **"+ Healthcheck Path"**
4. Enter: `/`
5. Save changes

---

## 🔍 Additional Verification

### Check Build Tab:

1. Go to **Build** tab
2. Verify:
   - **Root Directory:** `apps/web`
   - **Dockerfile Path:** `apps/web/Dockerfile`
   - **Build Command:** (empty)

### Check Variables Tab:

1. Go to **Variables** tab
2. Verify these are set:
   ```bash
   NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api
   NODE_ENV=production
   PORT=3000
   ```

---

## 🎯 After Making Changes

1. **Save all changes** in Railway dashboard
2. **Redeploy** the service:
   - Go to **Deployments** tab
   - Click **"Redeploy"** or trigger a new deployment
3. **Monitor build logs** to ensure:
   - ✅ Build completes successfully
   - ✅ Service starts without errors
   - ✅ Healthcheck passes (if enabled)

---

## 📝 Why These Changes Matter

### Custom Start Command Issue:

The current command `pnpm --filter @hos-marketplace/web start` is:
- Running from the wrong directory context
- Overriding the Dockerfile's CMD
- May not work correctly in the Docker container

The Dockerfile already sets:
```dockerfile
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
```

So the start command should be **empty** to let Dockerfile handle it.

### Healthcheck Path:

Adding `/` as healthcheck ensures:
- Railway knows when the service is ready
- Traffic is only routed after the service is healthy
- Better deployment reliability

---

## ✅ Final Checklist

Before deploying, ensure:

- [ ] Custom Start Command is **empty**
- [ ] Healthcheck Path is set to `/` (or disabled)
- [ ] Root Directory is `apps/web`
- [ ] Dockerfile Path is `apps/web/Dockerfile`
- [ ] Environment variables are set correctly
- [ ] Serverless is **disabled** (OFF)
- [ ] Restart Policy is configured (already done via railway.toml)

---

**Once these changes are made, redeploy the service and it should work correctly!**

