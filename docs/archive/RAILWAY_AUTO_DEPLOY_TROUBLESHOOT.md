# Railway Auto-Deploy Troubleshooting Guide

## Why Auto-Deploy Might Not Be Working

### 1. Check Source Connection

**Go to Railway Dashboard:**
1. Open your project
2. Click on `@hos-marketplace/web` service
3. Go to **Source** tab
4. Verify:
   - ✅ Repository is connected: `app-hos-uk/HOS-World`
   - ✅ Branch is set to: `master` (or your main branch)
   - ✅ Auto Deploy is **enabled** (toggle should be ON)

**If repository shows as disconnected:**
- Click "Connect Repository"
- Select `app-hos-uk/HOS-World`
- Select branch: `master`
- Enable "Auto Deploy"

### 2. Check Service Status

**Go to Service Settings:**
1. Check if service is **paused**
2. If paused, click "Resume" or "Unpause"
3. Paused services don't auto-deploy

### 3. Check GitHub Webhook

**In Railway Dashboard:**
1. Go to **Source** tab
2. Look for webhook status
3. If webhook is missing or failed:
   - Disconnect and reconnect the repository
   - Railway will recreate the webhook

**In GitHub:**
1. Go to your repository: `app-hos-uk/HOS-World`
2. Go to **Settings** → **Webhooks**
3. Look for Railway webhook
4. Check if it's active and receiving events

### 4. Verify Branch Name

**Common Issues:**
- Railway is watching `main` but you're pushing to `master`
- Or vice versa

**Fix:**
1. Go to Railway → Source tab
2. Check the branch name
3. Make sure it matches your GitHub branch
4. Update if needed

### 5. Check Deployment Settings

**Go to Deployments Tab:**
1. Check if there are any failed deployments blocking new ones
2. Cancel any stuck deployments
3. Check deployment history for errors

### 6. Manual Trigger Test

**To test if deployment works at all:**
1. Go to **Deployments** tab
2. Click **"Redeploy"** or **"Deploy"**
3. If manual deploy works but auto-deploy doesn't, it's a webhook/connection issue

### 7. Check Railway Status

**Sometimes Railway has issues:**
- Check Railway status page: https://status.railway.app
- Check Railway Discord/Twitter for announcements

### 8. Reconnect Repository

**If nothing works, try reconnecting:**
1. Go to **Source** tab
2. Click **"Disconnect Repository"**
3. Wait a few seconds
4. Click **"Connect Repository"**
5. Select `app-hos-uk/HOS-World`
6. Select branch: `master`
7. Enable **"Auto Deploy"**
8. Save

### 9. Check Recent Commits

**Verify commits are being pushed:**
```bash
git log --oneline -5
git remote -v
```

Make sure you're pushing to the correct remote:
```bash
git push origin master
```

### 10. Check Railway Logs

**In Railway Dashboard:**
1. Go to **Deployments** tab
2. Check if there are any webhook delivery errors
3. Look for error messages about webhook failures

## Quick Fix Checklist

- [ ] Repository is connected in Railway Source tab
- [ ] Branch name matches (master/main)
- [ ] Auto Deploy toggle is ON
- [ ] Service is not paused
- [ ] GitHub webhook exists and is active
- [ ] Recent commits are pushed to GitHub
- [ ] No stuck/failed deployments blocking new ones
- [ ] Railway status page shows no issues

## Force Auto-Deploy

**If auto-deploy is enabled but not triggering:**

1. **Push an empty commit:**
   ```bash
   git commit --allow-empty -m "Trigger Railway deployment"
   git push
   ```

2. **Or make a small change:**
   ```bash
   echo "# Trigger" >> README.md
   git add README.md
   git commit -m "Trigger deployment"
   git push
   ```

## Still Not Working?

**Contact Railway Support:**
- Railway Discord: https://discord.gg/railway
- Railway Support: support@railway.app
- Include:
  - Service name
  - Repository URL
  - Branch name
  - Screenshots of Source tab

