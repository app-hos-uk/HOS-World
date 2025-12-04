# 🌐 Configure Frontend Service in Railway

## Current Issue
The `@hos-marketplace/web` service is failing with:
```
Dockerfile 'Dockerfile' does not exist
```

## Two Options to Fix

### Option 1: Use Dockerfile (Recommended - Already Fixed)
The Dockerfile at `apps/web/Dockerfile` has been updated. Railway should now find it.

**Configuration:**
1. Go to `@hos-marketplace/web` service → **Settings** tab
2. Find **"Dockerfile Path"** field
3. Enter: `apps/web/Dockerfile`
4. Save

### Option 2: Use Build Commands (Alternative)

If you prefer to use build commands instead of Dockerfile:

1. Go to `@hos-marketplace/web` service → **Settings** tab
2. Find **"Builder"** section
3. Change from **"Dockerfile"** to **"Nixpacks"** or **"Buildpacks"**
4. Configure:

   **Root Directory:**
   - `apps/web`

   **Build Command:**
   - `cd ../.. && pnpm install && pnpm --filter @hos-marketplace/web build`

   **Start Command:**
   - `cd apps/web && pnpm start`

5. Save

---

## Recommended: Use Dockerfile (Option 1)

Since we've already fixed the Dockerfile, use Option 1. The Dockerfile is optimized for production builds.

---

## After Configuration

1. Railway will auto-redeploy
2. Add environment variables (see below)
3. Get the frontend URL from Settings → Networking

---

## Environment Variables for Frontend

Go to `@hos-marketplace/web` → **Variables** tab:

```
NEXT_PUBLIC_API_URL = https://your-backend-url.railway.app/api
NODE_ENV = production
PORT = 3000
```

*(Update `NEXT_PUBLIC_API_URL` after backend deploys successfully)*

---

**Quick Fix:** Set Dockerfile Path = `apps/web/Dockerfile` in Settings!

