# 🚨 CRITICAL: Fix Railway Source Settings (Root Directory)

## Current Problem

From your screenshots:
- ❌ Railway deploying commit `e06e36ff` (old commit - doesn't exist in repo)
- ❌ Railway **skipping** `apps/web/Dockerfile` with error: "not rooted at a valid path"
- ❌ Latest commits (`13fbe52`, `e24fb0a`) NOT deployed

**Root Cause:** Railway's **Source** settings have incorrect **Root Directory** configuration.

---

## ✅ REQUIRED FIX: Check Source Settings

### Step 1: Open Source Settings

**In Railway Dashboard:**

1. Go to: `@hos-marketplace/web` service → **Settings** tab
2. **Look at the RIGHT SIDEBAR** - you should see these categories:
   - Source ⚠️ **CHECK THIS ONE**
   - Networking
   - Build
   - Deploy
   - Config-as-code
   - Danger

3. **Click on "Source"** in the right sidebar

---

### Step 2: Check Root Directory Setting

**In the Source settings, look for:**

- **Root Directory** field
- **Current value might be:** `apps/web` or something else
- **WRONG:** If it's set to `apps/web` or anything other than EMPTY

**CRITICAL FIX:**

1. **If Root Directory shows `apps/web` or any value:**
   - **DELETE it** (clear the field)
   - **Leave it EMPTY** (blank)

2. **If Root Directory is already empty:**
   - Continue to Step 3

---

### Step 3: Verify Other Source Settings

**While in Source settings, also check:**

- ✅ Repository: `app-hos-uk/HOS-World`
- ✅ Branch: `master`
- ✅ Auto Deploy: **ENABLED** (ON/green)
- ✅ Root Directory: **(EMPTY - leave blank)**

---

### Step 4: Save and Reconnect

**If you changed Root Directory:**

1. **Click "Save"** or the save icon
2. **If Save doesn't work, try this:**
   - Click "Disconnect Repository"
   - Wait 5 seconds
   - Click "Connect Repository"
   - Select: `app-hos-uk/HOS-World`
   - Select branch: `master`
   - **Leave Root Directory EMPTY** (do not enter anything)
   - Enable Auto Deploy
   - Click "Connect"

---

## Why Root Directory Must Be Empty

Your Dockerfile at `apps/web/Dockerfile` expects:
- Build context = **Repository root** (`/`)
- Access to files: `package.json`, `pnpm-lock.yaml`, `packages/`, etc.

**If Root Directory is set to `apps/web`:**
- Railway builds from `apps/web` directory
- Can't see repository root files
- Railway rejects the nested Dockerfile
- Error: "not rooted at a valid path"

**Solution:** Leave Root Directory **EMPTY** so Railway uses repo root.

---

## Expected Results After Fix

1. ✅ Railway stops skipping `apps/web/Dockerfile`
2. ✅ Railway finds and uses the correct Dockerfile
3. ✅ Railway deploys latest commits (`13fbe52` or `e24fb0a`)
4. ✅ Build logs show: `found 'Dockerfile' at 'apps/web/Dockerfile'` (not "skipping")
5. ✅ Build completes successfully

---

## Verification Checklist

After fixing Source settings:

- [ ] Source → Root Directory is **EMPTY**
- [ ] Source → Repository is `app-hos-uk/HOS-World`
- [ ] Source → Branch is `master`
- [ ] Source → Auto Deploy is **ENABLED**
- [ ] Build → Dockerfile Path is `apps/web/Dockerfile`
- [ ] Latest deployment shows commit `13fbe52` or `e24fb0a` (not `e06e36ff`)
- [ ] Build logs show: `found 'Dockerfile' at 'apps/web/Dockerfile'` (not "skipping")

---

## Quick Action Items

1. ⚠️ **Go to:** Settings → **Source** (right sidebar)
2. ⚠️ **Check:** Root Directory setting
3. ⚠️ **Fix:** If set to anything, clear it (leave empty)
4. ⚠️ **Save** or reconnect repository
5. ⚠️ **Wait** 5-7 minutes for deployment

---

**Priority: URGENT - Fix Root Directory in Source settings now!**

