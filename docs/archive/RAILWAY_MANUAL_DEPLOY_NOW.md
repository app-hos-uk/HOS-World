# 🚀 Manual Railway Deployment Guide

## Quick Fix: Force Deployment

If auto-deployment isn't starting, here are several ways to trigger it manually:

## Method 1: Empty Commit (Recommended)

This is the easiest way to trigger a deployment without changing code:

```bash
git commit --allow-empty -m "Trigger Railway deployment"
git push
```

## Method 2: Railway Dashboard - Manual Redeploy

1. Go to Railway Dashboard
2. Select your project
3. Click on the `@hos-marketplace/web` service
4. Go to **Deployments** tab
5. Click **"Redeploy"** or **"Deploy Latest"** button
6. Select the latest commit (should show `ee88e78` or later)

## Method 3: Disconnect and Reconnect Repository

If webhook is broken:

1. Railway Dashboard → Project Settings
2. Go to **Source** tab
3. Click **"Disconnect"** repository
4. Click **"Connect Repository"** again
5. Select your GitHub repository
6. Select branch: `master` (or `main`)
7. Railway will trigger a fresh deployment

## Method 4: Check Webhook Status

1. Go to GitHub → Your Repository → Settings
2. Click **Webhooks** in left sidebar
3. Look for Railway webhook
4. Check if it's **Active** (green)
5. Click on webhook to see recent deliveries
6. If failed, try **"Redeliver"** for recent events

## Method 5: Verify Branch Connection

1. Railway Dashboard → `@hos-marketplace/web` service
2. Go to **Settings** tab
3. Check **"Source"** section
4. Verify:
   - Repository: `app-hos-uk/HOS-World`
   - Branch: `master` (or `main`)
   - Root Directory: (should be empty or `/`)
5. If wrong, update and save

## Method 6: Force Push (Last Resort)

Only if nothing else works:

```bash
# Make a small change
echo "# Deployment trigger" >> README.md
git add README.md
git commit -m "Trigger deployment: Fix image 404 errors"
git push origin master
```

## Verification Steps

After triggering deployment:

1. **Check Railway Dashboard:**
   - Go to `@hos-marketplace/web` service
   - Click **Deployments** tab
   - You should see a new deployment starting
   - Status should change from "Queued" → "Building" → "Deploying" → "Active"

2. **Monitor Build Logs:**
   - Click on the deployment
   - Watch the build logs
   - Look for any errors

3. **Check Service Status:**
   - After deployment completes
   - Service should show "Active" status
   - Visit your frontend URL
   - Check browser console - 404 errors should be gone

## Common Issues

### Issue: "No new commits detected"
**Solution:** Use Method 1 (empty commit) or Method 2 (manual redeploy)

### Issue: "Webhook not receiving events"
**Solution:** Use Method 3 (disconnect/reconnect) or Method 4 (check webhook)

### Issue: "Service paused"
**Solution:** 
- Railway Dashboard → Service Settings
- Check if service is paused
- Click **"Resume"** if paused

### Issue: "Wrong branch connected"
**Solution:** Use Method 5 to verify and update branch

## Quick Command to Trigger Now

Run this in your terminal:

```bash
cd "/Users/apple/Library/Mobile Documents/com~apple~CloudDocs/Desktop/HOS-latest Sabu"
git commit --allow-empty -m "Trigger Railway deployment - Fix image 404 errors"
git push origin master
```

This will immediately trigger a new deployment on Railway.

