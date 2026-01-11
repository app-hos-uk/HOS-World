# 🚀 Trigger API Service Deployment in Railway

## ❌ Issue: No Recent Deployments Found

If you can't see any recent deployments for `@hos-marketplace/api` in Railway, here's how to fix it:

---

## ✅ Step 1: Check Service Status

### In Railway Dashboard:

1. **Go to Railway Dashboard**: https://railway.app
2. **Navigate to your project**
3. **Look for `@hos-marketplace/api` service**
4. **Check if service exists:**
   - If service doesn't exist → You need to create it first
   - If service exists but shows "Paused" → Click "Resume" or "Start"
   - If service exists but no deployments → Continue to Step 2

---

## ✅ Step 2: Verify Source Connection

### Check if Service is Connected to GitHub:

1. **Go to `@hos-marketplace/api` service**
2. **Click "Settings" tab** (or look for "Source" section)
3. **Check "Source" section:**
   - ✅ Repository should be: `app-hos-uk/HOS-World`
   - ✅ Branch should be: `master` (or `main`)
   - ✅ **Root Directory** should be: `services/api`
   - ✅ **Auto Deploy** should be **ENABLED** (toggle ON/green)

### If Repository is NOT Connected:

1. **Click "Connect Repository"** or **"Connect GitHub"**
2. **Select repository**: `app-hos-uk/HOS-World`
3. **Select branch**: `master` (or your main branch)
4. **Set Root Directory**: `services/api` ⚠️ **IMPORTANT**
5. **Enable "Auto Deploy"** (toggle ON)
6. **Click "Connect"** or **"Save"**

**This will trigger an immediate deployment!**

---

## ✅ Step 3: Manual Deployment Trigger

### Option A: Empty Commit (Recommended)

This triggers a deployment without changing code:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
git commit --allow-empty -m "Trigger API deployment"
git push origin master
```

**Railway will auto-detect the push and deploy!**

### Option B: Railway Dashboard - Manual Deploy

1. **Go to `@hos-marketplace/api` service**
2. **Click "Deployments" tab**
3. **Look for:**
   - **"Deploy"** button (at the top)
   - **"Redeploy"** button (on latest deployment)
   - **"..."** menu → **"Redeploy"** option

4. **If you see "Deploy" button:**
   - Click it
   - Select the latest commit
   - Click "Deploy"

### Option C: Railway CLI

If you have Railway CLI installed:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
railway link  # Link to service if not already linked
railway up    # Trigger deployment
```

---

## ✅ Step 4: Verify Build Configuration

### Check Build Settings:

1. **Go to `@hos-marketplace/api` → Settings**
2. **Check "Build" section:**
   - **Root Directory**: `services/api` ⚠️ **CRITICAL**
   - **Dockerfile Path**: Should be `Dockerfile` (Railway will look in root or services/api)
   - **Build Command**: Should be **empty** (Dockerfile handles it)

3. **Check "Deploy" section:**
   - **Start Command**: Should be **empty** (Dockerfile CMD handles it)
   - **Health Check**: Can be disabled or `/api/health`

### If Root Directory is Wrong:

⚠️ **This is a common issue!**

- If Root Directory is empty or `/` → Change to `services/api`
- If Root Directory is wrong → Update to `services/api`
- Save changes → This will trigger a new deployment

---

## ✅ Step 5: Check Dockerfile Location

Railway needs to find the Dockerfile. Check:

1. **Dockerfile should exist at:**
   - `/Dockerfile` (root) - OR
   - `/services/api/Dockerfile`

2. **If Dockerfile is at root:**
   - Railway will use it automatically
   - Make sure Root Directory is `services/api`

3. **If Dockerfile is at `services/api/Dockerfile`:**
   - Set **Dockerfile Path** in Railway to `services/api/Dockerfile`
   - Or move Dockerfile to root

---

## ✅ Step 6: Check GitHub Webhook

### Verify Webhook is Active:

1. **Go to GitHub**: https://github.com/app-hos-uk/HOS-World
2. **Click "Settings"** (repository settings)
3. **Click "Webhooks"** (left sidebar)
4. **Look for Railway webhook:**
   - ✅ Should exist
   - ✅ Status should be **Active** (green)
   - ✅ Recent deliveries should show success (green checkmarks)

### If Webhook is Missing or Failed:

1. **Go back to Railway Dashboard**
2. **Disconnect repository** (Settings → Source → Disconnect)
3. **Reconnect repository** (Settings → Source → Connect)
4. **Railway will recreate the webhook**

---

## ✅ Step 7: Force Fresh Deployment

If nothing works, force a fresh deployment:

### Method 1: Disconnect and Reconnect

1. **Railway Dashboard** → `@hos-marketplace/api` → **Settings**
2. **Source section** → **Disconnect** repository
3. **Wait 10 seconds**
4. **Connect Repository** again:
   - Repository: `app-hos-uk/HOS-World`
   - Branch: `master`
   - Root Directory: `services/api`
   - Enable Auto Deploy
5. **Click "Connect"**

### Method 2: Make a Small Change

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
# Make a small change (add a comment)
echo "// Deployment trigger" >> src/main.ts
git add .
git commit -m "Trigger API deployment"
git push origin master
```

---

## ✅ Step 8: Watch Deployment

After triggering:

1. **Go to "Deployments" tab** in Railway
2. **You should see a new deployment appear**
3. **Click on it to watch build logs**
4. **Expected build steps:**
   - ✅ Installing dependencies
   - ✅ Building shared-types
   - ✅ Building API
   - ✅ Building Docker image
   - ✅ Deploying service
   - ✅ Service started

5. **Wait 3-5 minutes** for build to complete
6. **Check status** - should show "Active" or "Ready"

---

## 🔍 Troubleshooting

### Issue: "No deployments found"

**Possible causes:**
- Service is not connected to GitHub
- Auto Deploy is disabled
- Root Directory is wrong
- Service is paused

**Solution:**
- Follow Step 2 (Verify Source Connection)
- Check Root Directory is `services/api`
- Enable Auto Deploy

### Issue: "Deploy button is missing"

**Possible causes:**
- Service is paused
- No repository connected
- Permission issues

**Solution:**
- Resume service if paused
- Connect repository (Step 2)
- Check you have deployment permissions

### Issue: "Build fails immediately"

**Possible causes:**
- Wrong Root Directory
- Dockerfile not found
- Build command error

**Solution:**
- Verify Root Directory is `services/api`
- Check Dockerfile exists
- Review build logs for errors

### Issue: "Deployment shows but never completes"

**Possible causes:**
- Health check failing
- Environment variables missing
- Database connection error

**Solution:**
- Check deployment logs
- Verify environment variables are set
- Check health endpoint: `/api/health`

---

## 📋 Quick Checklist

Before triggering deployment, verify:

- [ ] Service `@hos-marketplace/api` exists in Railway
- [ ] Service is not paused
- [ ] Repository is connected: `app-hos-uk/HOS-World`
- [ ] Branch is set: `master` (or `main`)
- [ ] **Root Directory is: `services/api`** ⚠️ **CRITICAL**
- [ ] Auto Deploy is enabled
- [ ] Dockerfile exists (at root or `services/api/Dockerfile`)
- [ ] GitHub webhook is active

---

## 🎯 Most Common Fix

**The #1 issue is usually the Root Directory!**

Make sure in Railway Dashboard → `@hos-marketplace/api` → Settings:
- **Root Directory**: `services/api` (not empty, not `/`, not `apps/web`)

This single fix usually resolves "no deployments" issues!

---

## 📝 After Deployment

Once deployment completes:

1. **Test health endpoint:**
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/health
   ```

2. **Check deployment logs** for any errors

3. **Verify environment variables** are set correctly

4. **Test API endpoints** to ensure service is working

---

## 🔗 Related Documentation

- [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md)
- [Railway Verification Checklist](./RAILWAY_VERIFICATION_CHECKLIST.md)
- [Environment Variables Checklist](./ENV_VAR_CHECKLIST.md)
