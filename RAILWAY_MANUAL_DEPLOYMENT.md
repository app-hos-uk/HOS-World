# Railway Manual Deployment Guide

## ✅ Changes Pushed to GitHub

**Commit**: `a574b3a`  
**Branch**: `master`  
**Message**: "Fix: Login page stability - prevent auto-redirects and duplicate API requests"

**Files Changed**:
- `apps/web/src/app/login/page.tsx` - Login page stability fixes
- `apps/web/src/lib/api.ts` - Enhanced error handling
- `packages/api-client/src/client.ts` - Improved request handling
- `apps/web/src/app/layout.tsx` - Favicon fix

## 🚀 How to Deploy in Railway

### Step 1: Go to Railway Dashboard
1. Open: https://railway.app/dashboard
2. Select your project
3. Click on **`@hos-marketplace/web`** service

### Step 2: Trigger Deployment
**Option A: Redeploy Button**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **"Redeploy"** button (or three-dot menu → Redeploy)
4. Railway will pull latest code from GitHub and deploy

**Option B: Settings → Deploy**
1. Go to **Settings** tab
2. Scroll to **Deploy** section
3. Click **"Redeploy"** or **"Deploy Latest"**

### Step 3: Monitor Deployment
1. Go to **Deployments** tab
2. Watch the build logs
3. Look for:
   - ✅ "Installing dependencies..."
   - ✅ "Building application..."
   - ✅ "Compiling..."
   - ✅ "Ready in Xms"

**Expected Build Time**: 5-7 minutes

### Step 4: Verify Deployment
After deployment completes:

1. **Check Status**
   - Deployment should show as "Active" (green)
   - URL should be accessible

2. **Test Login Page**
   - Navigate to: https://hos-marketplaceweb-production.up.railway.app/login
   - Should stay on login page (no auto-redirect)
   - Open DevTools → Network tab
   - Should see 0-1 `/me` requests (not multiple)

3. **Check Console**
   - Open DevTools → Console
   - Should see no errors
   - Should see auth check logs if token exists

## 🔍 Troubleshooting

### If "Redeploy" Button Doesn't Work

1. **Check GitHub Connection**
   - Railway Dashboard → Settings → GitHub
   - Verify repository is connected
   - Check if branch is set to `master`

2. **Check Service Settings**
   - Railway Dashboard → Service → Settings
   - Verify Root Directory: `apps/web` (if monorepo)
   - Check Build Command and Start Command

3. **Manual Git Pull**
   - Railway Dashboard → Service → Settings → Deploy
   - Click "Clear build cache" if needed
   - Then click "Redeploy"

### If Build Fails

1. **Check Build Logs**
   - Railway Dashboard → Deployments → Latest
   - Look for error messages
   - Common issues:
     - Missing environment variables
     - Build command errors
     - Dependency installation failures

2. **Check Environment Variables**
   - Railway Dashboard → Variables tab
   - Verify `NEXT_PUBLIC_API_URL` is set
   - Value: `https://hos-marketplaceapi-production.up.railway.app/api`

3. **Check Root Directory**
   - Railway Dashboard → Settings
   - Root Directory should be: `apps/web`

## 📋 Quick Deployment Checklist

- [ ] Changes pushed to GitHub ✅
- [ ] Railway Dashboard opened
- [ ] Frontend service selected (`@hos-marketplace/web`)
- [ ] "Redeploy" button clicked
- [ ] Build logs monitored
- [ ] Deployment completed successfully
- [ ] Login page tested
- [ ] Network tab checked (0-1 `/me` requests)
- [ ] Console checked (no errors)

## 🎯 Expected Results After Deployment

### Login Page
- ✅ Stays stable on `/login` page
- ✅ No automatic redirects after 2 seconds
- ✅ Only redirects if user has valid token
- ✅ No duplicate API requests

### Network Performance
- ✅ 0-1 `/me` requests (not multiple)
- ✅ Fast load time (< 5 seconds)
- ✅ No hanging requests
- ✅ Proper request cancellation

### User Experience
- ✅ Page doesn't refresh automatically
- ✅ Login form is accessible
- ✅ No redirect loops
- ✅ Smooth navigation

---

**Status**: ✅ Code pushed to GitHub  
**Next**: Trigger deployment in Railway Dashboard

**Commit Hash**: `a574b3a`  
**Repository**: `app-hos-uk/HOS-World`  
**Branch**: `master`


