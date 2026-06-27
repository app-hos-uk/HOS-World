# 🚀 Frontend Railway Deployment - Quick Start

## Step 1: Create New Service

1. Go to Railway Dashboard → Your Project
2. Click **"New"** → **"GitHub Repo"**
3. Select: `app-hos-uk/HOS-World`
4. Railway will auto-detect the repo

## Step 2: Configure Service

**Settings Tab:**
- **Service Name:** `hos-marketplace-frontend` (or any name)
- **Root Directory:** `apps/web`
- **Dockerfile Path:** `apps/web/Dockerfile`

**Leave these empty (Dockerfile handles them):**
- Build Command: (empty)
- Start Command: (empty)

## Step 3: Set Environment Variables

**Variables Tab → Add these:**

```bash
NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api
NODE_ENV=production
PORT=3000
```

**Important:** Replace `hos-marketplaceapi-production.up.railway.app` with your actual backend URL if different.

## Step 4: Deploy

1. Click **"Deploy"** or wait for auto-deployment
2. Watch the build logs
3. Wait for "Ready on http://0.0.0.0:3000"

## Step 5: Update Backend CORS

In your **Backend API service** → **Variables Tab**, add:

```bash
FRONTEND_URL=https://your-frontend-url.railway.app
```

Replace `your-frontend-url.railway.app` with the Railway-generated frontend URL.

## ✅ Verify

1. Visit your frontend URL (shown in Railway dashboard)
2. Check if homepage loads
3. Open browser DevTools → Network tab
4. Verify API calls are working (no CORS errors)

## 🆘 Quick Troubleshooting

**Build fails?**
- Check build logs for errors
- Verify Dockerfile path is `apps/web/Dockerfile`
- Check if all dependencies are installed

**Can't connect to API?**
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check backend CORS includes frontend URL
- Verify backend is running

**Port errors?**
- Don't set PORT manually (Railway sets it)
- Remove any PORT override

---

**Full Guide:** See `FRONTEND_DEPLOYMENT_GUIDE.md` for detailed instructions.

