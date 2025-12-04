# Manual Railway Deployment Guide

If auto-deployment isn't working, here's how to trigger a manual deployment:

## Option 1: Trigger Deployment from Railway Dashboard

1. **Go to Railway Dashboard**
   - Navigate to your project
   - Click on the `@hos-marketplace/web` service

2. **Go to Deployments Tab**
   - Click on "Deployments" in the service menu
   - You should see a list of deployments

3. **Trigger New Deployment**
   - Click the **"Redeploy"** button (or "Deploy" if available)
   - Or click the **"..."** menu on the latest deployment and select "Redeploy"

## Option 2: Check Source Connection

1. **Go to Source Tab**
   - In your service settings
   - Verify the repository is connected: `app-hos-uk/HOS-World`
   - Check the branch is set to `master` (or your main branch)

2. **Reconnect if Needed**
   - If repository shows as disconnected, click "Connect Repository"
   - Select `app-hos-uk/HOS-World`
   - Select branch: `master`

## Option 3: Check Auto-Deploy Settings

1. **Go to Source Tab**
   - Look for "Auto Deploy" or "Automatic Deployments" setting
   - Make sure it's **enabled**
   - If disabled, enable it

## Option 4: Force Deployment via Railway CLI

If you have Railway CLI installed:

```bash
railway up
```

Or:

```bash
railway deploy
```

## Option 5: Push a Small Change

Sometimes a new commit triggers deployment:

```bash
git commit --allow-empty -m "Trigger deployment"
git push
```

## Verification

After triggering deployment:

1. **Check Build Logs**
   - Go to "Deployments" tab
   - Click on the latest deployment
   - Watch the build logs in real-time

2. **Expected Build Steps:**
   - ✅ Installing dependencies
   - ✅ Building shared-types
   - ✅ Building theme-system
   - ✅ Building other packages
   - ✅ Building web app
   - ✅ Build completed successfully

## Troubleshooting

### If "Redeploy" button is missing:
- Check if service is paused
- Verify you have deployment permissions
- Try disconnecting and reconnecting the repository

### If deployment fails immediately:
- Check build logs for errors
- Verify Dockerfile path is correct: `apps/web/Dockerfile`
- Check environment variables are set

### If deployment hangs:
- Check Railway status page
- Try canceling and redeploying
- Check service resource limits

