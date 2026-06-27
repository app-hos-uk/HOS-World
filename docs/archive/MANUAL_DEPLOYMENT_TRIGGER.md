# 🚀 Manual Deployment Trigger Guide

## ✅ Code Pushed Successfully!

I've committed and pushed the admin endpoint code. Railway should auto-deploy, but if it doesn't, here's how to trigger manually:

---

## 🎯 Method 1: Railway Dashboard - Manual Redeploy

### Step 1: Go to Railway Dashboard

1. Open Railway Dashboard
2. Navigate to your project
3. Click on **`@hos-marketplace/api`** service (backend service)

### Step 2: Trigger Deployment

1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click the **"..."** (three dots) menu
4. Select **"Redeploy"** or **"Deploy"**

**OR:**

1. Look for a **"Deploy"** or **"Redeploy"** button at the top
2. Click it to trigger a new deployment

---

## 🎯 Method 2: Check Auto-Deploy Settings

### Step 1: Verify Source Connection

1. Go to **`@hos-marketplace/api`** service
2. Click **"Settings"** tab
3. Look for **"Source"** section
4. Verify:
   - ✅ Repository: `app-hos-uk/HOS-World`
   - ✅ Branch: `master` (or your main branch)
   - ✅ **Auto Deploy** is **ENABLED** (toggle should be ON/green)

### Step 2: Reconnect if Needed

If repository shows as disconnected:
1. Click **"Connect Repository"**
2. Select: `app-hos-uk/HOS-World`
3. Select branch: `master`
4. Enable **"Auto Deploy"**
5. Click **"Connect"**

---

## 🎯 Method 3: Railway CLI

If you have Railway CLI:

```bash
cd services/api
railway link  # If not already linked
railway up    # Trigger deployment
```

---

## ⏱️ Wait for Deployment

After triggering:
1. **Watch build logs** in Railway Dashboard
2. **Wait 3-5 minutes** for build to complete
3. **Check deployment status** - should show "Active" or "Ready"

---

## ✅ Test Endpoint After Deployment

Once deployment completes, test the endpoint:

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/create-team-users \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "data": {
    "users": [...],
    "totalCreated": 7,
    "totalUpdated": 0
  },
  "message": "Team users creation completed"
}
```

---

## 📋 What Was Pushed

**Files committed:**
- `services/api/src/admin/admin.module.ts` (new)
- `services/api/src/admin/create-team-users.controller.ts` (new)
- `services/api/src/app.module.ts` (updated)
- `services/api/package.json` (updated)

**Commit:** `e27114d` - "Add admin endpoint to create team role users"

---

**Code is pushed! Now trigger deployment in Railway Dashboard!** 🚀

