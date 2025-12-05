# Dockerfile Environment Variable Fix

## Problem
The frontend build was using `localhost:3001` because `NEXT_PUBLIC_API_URL` wasn't available during the Docker build step.

## Solution
Updated `apps/web/Dockerfile` to accept build-time environment variables using `ARG` and `ENV` declarations.

## What Changed
- Added `ARG` declarations for `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CMS_URL`, and `NEXT_PUBLIC_FRONTEND_URL`
- Set them as `ENV` variables so Next.js can access them during `pnpm build`
- Added debug echo to verify variables are set in build logs

## Next Steps

### Option 1: Railway Auto-Detection (Preferred)
Railway should automatically pass environment variables as build arguments. After committing this change:
1. Push to GitHub
2. Railway will trigger a new deployment
3. Check build logs for: `Building with NEXT_PUBLIC_API_URL=...`
4. If the variable shows in logs → Success!
5. If it's empty → Use Option 2

### Option 2: Manual Build Args (If Needed)
If Railway doesn't auto-pass env vars, you may need to configure build args in Railway:

1. Go to Railway Dashboard → `@hos-marketplace/web` service
2. Settings → Build
3. Add build arguments:
   - `NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api`
   - `NEXT_PUBLIC_CMS_URL=...` (if needed)
   - `NEXT_PUBLIC_FRONTEND_URL=...` (if needed)

### Option 3: Railway.json Configuration
If Railway supports it, create/update `railway.json`:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "buildCommand": "docker build --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL -f apps/web/Dockerfile ."
  }
}
```

## Verification
After deployment:
1. Open incognito window
2. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
3. Open DevTools → Console
4. Check network requests - should call Railway API, not localhost
5. Try login - should work!

## Current Status
✅ Dockerfile updated to accept build args
⏳ Waiting for deployment to test


