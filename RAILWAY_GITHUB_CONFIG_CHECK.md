# 🔍 Railway-GitHub Configuration Check

## ❌ Issue: Deployment Not Triggering After Git Push

Railway should auto-deploy when you push to GitHub, but it's not happening. Let's check the configuration.

---

## ✅ Step-by-Step Configuration Check

### Step 1: Check Source Connection

**In Railway Dashboard:**

1. **Go to:** `@hos-marketplace/web` service
2. **Click:** **Settings** tab (or look for **Source** section)
3. **Look for:** "Source" or "Repository" section
4. **Verify:**
   - ✅ Repository is connected: `app-hos-uk/HOS-World`
   - ✅ Branch is set to: `master` (must match your GitHub branch)
   - ✅ **Auto Deploy** is **ENABLED** (toggle should be ON/green)
   - ✅ Root Directory: `apps/web` (for frontend service)

**If repository shows as "Not Connected" or "Disconnected":**
- Click **"Connect Repository"** or **"Connect GitHub"**
- Select: `app-hos-uk/HOS-World`
- Select branch: `master`
- Set Root Directory: `apps/web`
- Enable **"Auto Deploy"**
- Click **"Connect"** or **"Save"**

---

### Step 2: Check Service Settings

**In Railway Dashboard → `@hos-marketplace/web` → Settings:**

**Build Settings:**
- **Root Directory:** Should be `apps/web`
- **Dockerfile Path:** Should be `apps/web/Dockerfile` (or just `Dockerfile` if Railway auto-detects)
- **Build Command:** Should be **empty** (Dockerfile handles it)

**Deploy Settings:**
- **Start Command:** Should be **empty** (Dockerfile handles it)
- **Health Check:** Can be disabled or set to `/`

---

### Step 3: Check GitHub Webhook

**In GitHub:**

1. **Go to:** https://github.com/app-hos-uk/HOS-World
2. **Click:** **Settings** (repository settings)
3. **Click:** **Webhooks** (left sidebar)
4. **Look for:** Railway webhook
5. **Check:**
   - ✅ Webhook exists
   - ✅ Status is **Active** (green)
   - ✅ URL points to Railway
   - ✅ Recent deliveries show successful (green checkmarks)

**If webhook is missing or failed:**
- Go back to Railway Dashboard
- Disconnect and reconnect the repository
- Railway will recreate the webhook

---

### Step 4: Check Service Status

**In Railway Dashboard → `@hos-marketplace/web`:**

1. **Check if service is paused:**
   - Look for "Paused" status
   - If paused, click **"Resume"** or **"Unpause"**
   - Paused services don't auto-deploy

2. **Check deployment history:**
   - Go to **Deployments** tab
   - Look for any stuck/failed deployments
   - Cancel any stuck deployments

---

### Step 5: Manual Trigger Test

**To test if deployment works at all:**

1. **Railway Dashboard** → `@hos-marketplace/web` → **Deployments** tab
2. **Look for:** "Redeploy" or "Deploy Latest" button
3. **Click it**
4. **If manual deploy works:**
   - The service can deploy
   - Issue is with auto-deploy/webhook
5. **If manual deploy doesn't work:**
   - There's a build/deployment issue
   - Check build logs for errors

---

## 🔧 Common Configuration Issues

### Issue 1: Root Directory Wrong

**Problem:** Railway is building from root instead of `apps/web`

**Fix:**
1. Railway Dashboard → `@hos-marketplace/web` → Settings
2. Find **"Root Directory"** or **"Build Root"**
3. Set to: `apps/web`
4. Save

### Issue 2: Branch Mismatch

**Problem:** Railway watching `main` but you're pushing to `master` (or vice versa)

**Fix:**
1. Railway Dashboard → Source tab
2. Check branch name
3. Update to match your GitHub branch (`master`)
4. Save

### Issue 3: Auto Deploy Disabled

**Problem:** Auto Deploy toggle is OFF

**Fix:**
1. Railway Dashboard → Source tab
2. Find **"Auto Deploy"** toggle
3. Turn it **ON**
4. Save

### Issue 4: Webhook Broken

**Problem:** GitHub webhook not receiving events

**Fix:**
1. Railway Dashboard → Source tab
2. Click **"Disconnect Repository"**
3. Click **"Connect Repository"** again
4. Select repository and branch
5. Enable Auto Deploy
6. Save

---

## 🎯 Quick Fix: Reconnect Repository

**This often fixes webhook and auto-deploy issues:**

1. **Railway Dashboard** → `@hos-marketplace/web` → **Settings** or **Source** tab
2. **Find:** Repository connection section
3. **Click:** **"Disconnect"** or **"Disconnect Repository"**
4. **Wait:** A few seconds
5. **Click:** **"Connect Repository"** or **"Connect GitHub"**
6. **Select:**
   - Repository: `app-hos-uk/HOS-World`
   - Branch: `master`
   - Root Directory: `apps/web`
7. **Enable:** **Auto Deploy** (toggle ON)
8. **Click:** **"Connect"** or **"Save"**
9. **Railway will trigger a new deployment immediately**

---

## 📋 Configuration Checklist

**In Railway Dashboard → `@hos-marketplace/web` → Settings:**

- [ ] Repository connected: `app-hos-uk/HOS-World`
- [ ] Branch: `master` (matches GitHub)
- [ ] Root Directory: `apps/web`
- [ ] Auto Deploy: **ENABLED** (ON)
- [ ] Service Status: **Active** (not paused)
- [ ] Dockerfile Path: `apps/web/Dockerfile` (or auto-detected)

**In GitHub → Repository Settings → Webhooks:**

- [ ] Railway webhook exists
- [ ] Webhook status: **Active** (green)
- [ ] Recent deliveries: **Successful** (green checkmarks)

---

## 🆘 If Still Not Working

### Check 1: Railway Status
- Visit: https://status.railway.app
- Check if Railway has any ongoing issues

### Check 2: GitHub Permissions
- Railway app needs access to your repository
- Check GitHub → Settings → Applications → Authorized OAuth Apps
- Railway should be listed and authorized

### Check 3: Manual Deploy
- Try manual "Redeploy" button in Railway
- If that works, it's an auto-deploy/webhook issue
- If that doesn't work, it's a build/deployment issue

---

## 🎯 Recommended Action

**Try reconnecting the repository first:**

1. Railway Dashboard → `@hos-marketplace/web` → Settings
2. Disconnect repository
3. Reconnect repository
4. Set Root Directory: `apps/web`
5. Enable Auto Deploy
6. This will trigger an immediate deployment

---

**Check the Source/Settings tab in Railway and verify all these settings!**

