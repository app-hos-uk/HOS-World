# Manual Deployment Guide

## Services That Need Deployment

### 1. Frontend Service (Web App) 🔴 **REQUIRES DEPLOYMENT**
**Service**: `hos-marketplaceweb-production`
**Changes Made**:
- ✅ Login page input visibility fixes
- ✅ API URL default changed to production
- ✅ Debug logging added to login handler
- ✅ Debug logging added to seller dashboard
- ✅ Navigation buttons added to all dashboards
- ✅ New pages created (procurement/submissions, fulfillment/shipments, etc.)

**Why Manual Deployment?**:
- Railway may not auto-deploy if watching wrong paths
- Need to ensure latest changes are live for testing

**How to Deploy**:
1. Go to Railway dashboard: https://railway.app/dashboard
2. Select the **Web/Frontend** service (`hos-marketplaceweb-production`)
3. Go to **Settings** → **Deploy**
4. Click **Redeploy** or trigger a new deployment from the latest commit
5. Wait for build to complete (usually 5-10 minutes)

---

### 2. Backend Service (API) 🔴 **REQUIRES DEPLOYMENT**
**Service**: `hos-marketplaceapi-production`
**Changes Made**:
- ✅ New `/admin/users` endpoint added
- ✅ AdminUsersController created
- ✅ AdminModule updated

**Why Manual Deployment?**:
- New endpoint needs to be available for Admin Users page

**How to Deploy**:
1. Go to Railway dashboard: https://railway.app/dashboard
2. Select the **API/Backend** service (`hos-marketplaceapi-production`)
3. Go to **Settings** → **Deploy**
4. Click **Redeploy** or trigger a new deployment
5. Wait for build to complete (usually 5-10 minutes)

---

## Deployment Checklist

### Before Deployment
- [x] All changes committed to Git
- [x] All changes pushed to GitHub
- [ ] Verify latest commit includes all changes

### Frontend Deployment
- [ ] Navigate to Railway Web Service
- [ ] Check latest commit hash matches local
- [ ] Trigger deployment
- [ ] Monitor build logs
- [ ] Verify deployment successful
- [ ] Test login page (check input visibility)
- [ ] Test dashboard pages (check debug logs in console)

### Backend Deployment
- [ ] Navigate to Railway API Service
- [ ] Check latest commit hash matches local
- [ ] Trigger deployment
- [ ] Monitor build logs
- [ ] Verify deployment successful
- [ ] Test `/api/admin/users` endpoint with curl

---

## Verification Steps After Deployment

### Frontend Verification
1. **Login Page**:
   - ✅ Check input fields are visible (white background)
   - ✅ Test login with admin@hos.test
   - ✅ Check browser console for `[LOGIN]` debug messages
   - ✅ Verify redirect to dashboard works

2. **Dashboards**:
   - ✅ Check all 8 dashboards load
   - ✅ Check browser console for `[SELLER DASHBOARD]` debug messages
   - ✅ Verify network requests to `/api/dashboard/*` endpoints
   - ✅ Check if content/stats cards appear

3. **Navigation Pages**:
   - ✅ Test `/procurement/submissions`
   - ✅ Test `/fulfillment/shipments`
   - ✅ Test `/catalog/entries`
   - ✅ Test `/marketing/materials`
   - ✅ Test `/finance/pricing`
   - ✅ Test `/admin/users` (should work after backend deployment)
   - ✅ Test `/admin/settings`

### Backend Verification
1. **New Endpoint**:
   ```bash
   curl -X GET https://hos-marketplaceapi-production.up.railway.app/api/admin/users \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Existing Endpoints**:
   - ✅ Test login endpoint still works
   - ✅ Test dashboard endpoints return data

---

## Troubleshooting

### If Deployment Fails

**Frontend Build Errors**:
- Check build logs in Railway
- Verify all dependencies installed
- Check for TypeScript errors
- Verify environment variables set

**Backend Build Errors**:
- Check build logs in Railway
- Verify Prisma migrations complete
- Check database connection
- Verify all modules registered

### If Changes Don't Appear

1. **Hard Refresh**: Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)
2. **Check Deployment**: Verify deployment actually completed
3. **Check Commit**: Ensure latest commit was deployed
4. **Check Environment**: Verify environment variables are set correctly

---

## Railway Services Overview

### Service 1: Web/Frontend
- **Name**: `hos-marketplaceweb-production` (or similar)
- **Type**: Next.js Web Application
- **URL**: `https://hos-marketplaceweb-production.up.railway.app`
- **Environment Variables Needed**:
  - `NEXT_PUBLIC_API_URL` (should be: `https://hos-marketplaceapi-production.up.railway.app/api`)

### Service 2: API/Backend
- **Name**: `hos-marketplaceapi-production` (or similar)
- **Type**: NestJS API
- **URL**: `https://hos-marketplaceapi-production.up.railway.app`
- **Environment Variables Needed**:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - (and others)

---

## Quick Deploy Commands

If you have Railway CLI installed:
```bash
# Deploy frontend
railway up --service hos-marketplaceweb-production

# Deploy backend
railway up --service hos-marketplaceapi-production
```

But the easiest way is through Railway dashboard UI.

---

## Summary

**Yes, you should deploy manually** to ensure all changes are live.

**Services to Deploy**:
1. ✅ **Frontend (Web)** - Multiple UI fixes and new pages
2. ✅ **Backend (API)** - New admin/users endpoint

**Priority**: Both are important, but frontend has more changes.

