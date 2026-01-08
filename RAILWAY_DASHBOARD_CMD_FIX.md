# 🚨 CRITICAL: Fix Railway Dashboard Start Command

## Problem
Even though the Dockerfile is fixed, Railway is still using the old CMD and showing `[sh,` error.

**Root Cause:** Railway Dashboard settings override the Dockerfile CMD.

## ✅ REQUIRED FIX: Clear Dashboard Start Command

### Step 1: Go to Railway Dashboard

1. Open: https://railway.com/project/26dc565d-51d1-4050-8fd1-87c5714eb947
2. Click on **`@hos-marketplace/api`** service
3. Go to **Settings** tab
4. Click on **Deploy** section (in the right sidebar)

### Step 2: Clear Custom Start Command

**Look for "Custom Start Command" or "Start Command" field:**

1. **If there's ANY text in this field:**
   - **DELETE IT** (clear the entire field)
   - Leave it **completely EMPTY**
   - Click **Save**

2. **If the field is already empty:**
   - Continue to Step 3

### Step 3: Verify Other Settings

While in the Deploy settings, also check:

- **Healthcheck Path:** Should be empty or `/api/health`
- **Healthcheck Timeout:** Can be 300 or empty
- **Enable Healthcheck:** Can be ON or OFF (doesn't matter for now)

### Step 4: Force Fresh Deployment

After clearing the start command:

1. Go to **Deployments** tab
2. Click **"Redeploy"** or **"Deploy Latest"**
3. This will force Railway to use the Dockerfile CMD

## Why This Happens

Railway has a priority order for start commands:
1. **Dashboard Settings** (highest priority) ← This is overriding!
2. `railway.toml` startCommand
3. Dockerfile CMD (lowest priority)

Even though we fixed the Dockerfile, Railway is using a cached start command from the dashboard.

## Verification

After clearing and redeploying, check the deployment logs:

**Should see:**
```
Starting Container
✅ Server is listening on port 3001
```

**Should NOT see:**
```
[sh,: not found
```

## Alternative: Use Railway CLI

If you prefer CLI:

```bash
# Link to API service
railway link --service @hos-marketplace/api

# Check current variables (start command might be in variables)
railway variables

# Force redeploy
railway up
```

## Summary

1. ✅ Dockerfile is fixed (`CMD node dist/main.js`)
2. ❌ Railway Dashboard has old start command cached
3. ✅ **ACTION:** Clear start command in dashboard
4. ✅ **ACTION:** Force redeploy
