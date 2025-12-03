# Configure Existing Frontend Service (@hos-marketplace/web)

Since you already have the `@hos-marketplace/web` service in Railway, you just need to **verify and update its configuration**.

## ✅ Step 1: Verify Service Settings

Go to Railway Dashboard → `@hos-marketplace/web` service → **Settings** tab:

**Check these settings:**

1. **Root Directory:** Should be `apps/web`
   - If empty or different, set it to: `apps/web`

2. **Dockerfile Path:** Should be `apps/web/Dockerfile`
   - If empty or different, set it to: `apps/web/Dockerfile`

3. **Build Command:** Should be **empty** (Dockerfile handles it)
   - If there's a build command, remove it

4. **Start Command:** Should be **empty** (Dockerfile handles it)
   - If there's a start command, remove it

5. **Port:** Should be auto-detected (usually 3000)
   - Don't manually set this

## ✅ Step 2: Set Environment Variables

Go to **Variables** tab and add/verify these:

**Required Variables:**
```bash
NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api
NODE_ENV=production
PORT=3000
```

**Important:** 
- Replace `hos-marketplaceapi-production.up.railway.app` with your actual backend API URL
- Make sure there's no trailing slash on the API URL

## ✅ Step 3: Update Backend CORS

In your **Backend API service** (`@hos-marketplace/api`) → **Variables** tab:

Add or update:
```bash
FRONTEND_URL=https://your-frontend-url.railway.app
```

**To find your frontend URL:**
1. Go to `@hos-marketplace/web` service
2. Click on **Settings** → **Networking**
3. Copy the Railway-generated domain (e.g., `hos-marketplace-web-production.up.railway.app`)
4. Use that in the backend's `FRONTEND_URL` variable

## ✅ Step 4: Redeploy

1. Go to `@hos-marketplace/web` service
2. Click **"Deploy"** or **"Redeploy"**
3. Watch the build logs
4. Wait for deployment to complete

## 🔍 Verification Checklist

After deployment, check:

- [ ] Build completes successfully
- [ ] Service starts without errors
- [ ] Frontend URL loads in browser
- [ ] Homepage displays correctly
- [ ] API calls work (check browser DevTools → Network tab)
- [ ] No CORS errors in console
- [ ] Images load properly

## 🆘 Troubleshooting

### Service Not Building

**Check:**
- Root Directory is set to `apps/web`
- Dockerfile Path is set to `apps/web/Dockerfile`
- Build logs for specific errors

### Service Not Starting

**Check:**
- Environment variables are set correctly
- `NEXT_PUBLIC_API_URL` points to your backend
- Runtime logs for startup errors
- Port is not manually overridden

### API Connection Issues

**Check:**
- `NEXT_PUBLIC_API_URL` is correct (no trailing slash)
- Backend `FRONTEND_URL` includes your frontend URL
- Backend CORS is configured correctly
- Backend is running and accessible

### Build Errors

**Common issues:**
- Missing dependencies → Check if all packages are in Dockerfile
- TypeScript errors → Check build logs for specific errors
- Module not found → Verify workspace packages are included

## 📝 Quick Reference

**Service Name:** `@hos-marketplace/web`  
**Root Directory:** `apps/web`  
**Dockerfile:** `apps/web/Dockerfile`  
**Port:** Auto-detected (3000)  

**Required Env Vars:**
- `NEXT_PUBLIC_API_URL` - Your backend API URL
- `NODE_ENV` - `production`
- `PORT` - `3000` (or let Railway set it)

---

**You're all set!** Just verify the settings above and redeploy if needed.

