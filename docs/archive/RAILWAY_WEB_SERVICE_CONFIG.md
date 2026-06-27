# 🚨 Critical: Railway Web Service Configuration Fix

## Current Issues

From your Railway dashboard logs:
1. ❌ Railway is deploying commit `f1003880` (doesn't exist in repo - OLD/CACHED)
2. ❌ Railway is skipping `apps/web/Dockerfile` - "not rooted at a valid path"
3. ❌ Latest commits (`13fbe52`, `e24fb0a`) are not being deployed

---

## ✅ Required Railway Dashboard Settings

### Step 1: Verify Source Connection

**Go to:** Railway Dashboard → `@hos-marketplace/web` service → **Settings** → **Source** tab

**Verify:**
- ✅ Repository: `app-hos-uk/HOS-World`
- ✅ Branch: `master` (must match exactly)
- ✅ **Auto Deploy:** ENABLED (toggle ON/green)
- ✅ Root Directory: **LEAVE EMPTY** or set to `/` (for monorepo)

**If wrong, fix it:**
1. Click "Disconnect Repository"
2. Click "Connect Repository" 
3. Select: `app-hos-uk/HOS-World`
4. Select branch: `master`
5. **Leave Root Directory EMPTY** (this is critical!)
6. Enable "Auto Deploy"
7. Click "Connect"

---

### Step 2: Configure Build Settings

**Go to:** Railway Dashboard → `@hos-marketplace/web` service → **Settings** → **Build** tab

**Set these EXACT values:**

| Setting | Value |
|---------|-------|
| **Builder** | `Dockerfile` |
| **Root Directory** | **LEAVE EMPTY** (critical for monorepo) |
| **Dockerfile Path** | `apps/web/Dockerfile` |
| **Build Command** | **(LEAVE EMPTY)** |
| **Docker Build Context** | **(LEAVE EMPTY or `/`)** |

**Why Root Directory must be empty:**
- Your Dockerfile at `apps/web/Dockerfile` expects the build context to be the repository root
- It copies files from root: `package.json`, `pnpm-lock.yaml`, etc.
- If Root Directory is set to `apps/web`, Railway can't find these files

---

### Step 3: Configure Deploy Settings

**Go to:** Railway Dashboard → `@hos-marketplace/web` service → **Settings** → **Deploy** tab

**Set these EXACT values:**

| Setting | Value |
|---------|-------|
| **Start Command** | **(LEAVE EMPTY)** |
| **Healthcheck Path** | `/` (or leave disabled) |
| **Serverless** | **DISABLED** (OFF) |
| **Restart Policy** | On Failure (already in railway.toml) |

**Why Start Command must be empty:**
- Your Dockerfile already has: `CMD ["pnpm", "start"]`
- Custom start command overrides this and causes issues

---

### Step 4: Force Fresh Deployment

After fixing settings, you need to trigger a deployment from the LATEST commit:

**Option A: Redeploy Latest (Recommended)**
1. Go to **Deployments** tab
2. Click "Deploy Latest" or "Redeploy"
3. **Important:** Make sure it selects the latest commit (`13fbe52` or `e24fb0a`)
4. If it shows `f1003880`, disconnect and reconnect the repository first

**Option B: Push Empty Commit (Alternative)**
If redeploy still uses old commit, push a new commit:
```bash
git commit --allow-empty -m "Force Railway deployment - fix config"
git push origin master
```

---

## 🔍 Verification Steps

### Check 1: Verify Latest Commit is Deployed

**In Railway Dashboard:**
1. Go to **Deployments** tab
2. Look at the latest deployment
3. **Commit hash should be:** `13fbe52` or `e24fb0a`
4. **NOT:** `f1003880` (this is wrong!)

### Check 2: Verify Dockerfile is Used

**In Build Logs, you should see:**
- ✅ `found 'Dockerfile' at 'apps/web/Dockerfile'`
- ❌ NOT: `skipping 'Dockerfile' at 'apps/web/Dockerfile'`

### Check 3: Verify Build Completes

**Build logs should show:**
- ✅ `Building with NEXT_PUBLIC_API_URL=...`
- ✅ `Compiling...`
- ✅ `Build completed successfully`

---

## 🎯 Expected Results After Fix

1. ✅ Railway deploys commit `13fbe52` or `e24fb0a`
2. ✅ Railway finds and uses `apps/web/Dockerfile`
3. ✅ Build completes successfully
4. ✅ Login page shows `[LOGIN FIX v6.0]` in console
5. ✅ Only 1-2 component mounts (not 7+)

---

## 📝 Summary of Critical Settings

**MUST BE SET:**
- Source → Root Directory: **EMPTY**
- Build → Root Directory: **EMPTY**  
- Build → Dockerfile Path: `apps/web/Dockerfile`
- Deploy → Start Command: **EMPTY**

**These settings ensure:**
- Railway uses repo root as build context
- Railway finds the correct Dockerfile
- Dockerfile can access all monorepo files
- Latest code is deployed

---

**After making these changes, Railway will automatically redeploy. Wait 5-7 minutes and check the deployment.**

