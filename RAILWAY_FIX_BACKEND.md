# 🔧 Fix Backend Service Deployment - Railway

## Problem
The `@hos-marketplace/api` service is failing with error:
```
Dockerfile 'Dockerfile' does not exist
```

## Root Cause
Railway is looking for a Dockerfile in the root directory, but your Dockerfile is located at `services/api/Dockerfile`.

## Solution: Configure Dockerfile Path in Railway Dashboard

### Step 1: Open Backend Service Settings

1. In Railway dashboard, click on **`@hos-marketplace/api`** service
2. Go to **"Settings"** tab
3. Scroll down to the **"Build"** section

### Step 2: Configure Dockerfile Path

1. Find the **"Dockerfile Path"** field
2. Enter the path: **`services/api/Dockerfile`**
3. Click **"Save"** or the checkmark

### Step 3: Verify Build Configuration

Make sure these settings are correct:

**Root Directory:** (if available)
- Should be: `services/api` OR leave empty (since Dockerfile handles context)

**Dockerfile Path:**
- Must be: `services/api/Dockerfile`

**Build Command:** (if visible)
- Can be empty (Dockerfile handles build)

**Start Command:** (if visible)
- Can be empty (Dockerfile CMD handles start)

### Step 4: Redeploy

1. Railway will automatically redeploy when you save
2. Go to **"Deployments"** tab to watch the build
3. Wait for deployment to complete (5-10 minutes)

---

## Alternative: If Dockerfile Path Field Doesn't Exist

If you don't see a "Dockerfile Path" field in Settings:

### Option A: Use Railway's Config-as-Code

1. In Settings, look for **"Config-as-code"** section
2. Click **"Open file"** next to railway.toml
3. Update the file to specify the Dockerfile path

### Option B: Move Dockerfile (NOT RECOMMENDED)

This would break the monorepo structure, so avoid this option.

---

## Expected Result

After fixing the Dockerfile path:
- ✅ Build should start successfully
- ✅ Docker will find the Dockerfile at `services/api/Dockerfile`
- ✅ Service should deploy and become active

---

## Next Steps After Backend Deploys

1. Get backend URL from Settings → Networking
2. Add environment variables (see `RAILWAY_ENV_TEMPLATE.md`)
3. Configure frontend service similarly
4. Update cross-service URLs

---

**Quick Fix:** Just set `Dockerfile Path = services/api/Dockerfile` in Settings!

