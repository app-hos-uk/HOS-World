# Railway Build Arguments Check

## ⚠️ Important: Railway Build Args

Railway **may not automatically** pass environment variables as Docker build arguments. We need to verify and potentially configure this.

## Step 1: Check Build Logs

After the new deployment starts:

1. Go to Railway Dashboard → `@hos-marketplace/web` service
2. Click on the latest deployment
3. Look for this line in build logs:
   ```
   Building with NEXT_PUBLIC_API_URL=...
   ```

### If you see the URL:
✅ Build args are working! The build should use the correct API URL.

### If you see empty or `Building with NEXT_PUBLIC_API_URL=`:
❌ Railway isn't passing env vars as build args. Continue to Step 2.

## Step 2: Configure Build Arguments in Railway

If the variable is empty in build logs:

### Option A: Railway Dashboard (If Available)
1. Railway Dashboard → `@hos-marketplace/web` service
2. Settings → Build
3. Look for "Build Arguments" or "Docker Build Args"
4. Add:
   - `NEXT_PUBLIC_API_URL` = `https://hos-marketplaceapi-production.up.railway.app/api`
   - `NEXT_PUBLIC_CMS_URL` = (if you have one)
   - `NEXT_PUBLIC_FRONTEND_URL` = `https://hos-marketplaceweb-production.up.railway.app`

### Option B: Railway CLI
```bash
railway variables set NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api --service @hos-marketplace/web
```

Then check if Railway has a way to mark variables as "build-time" variables.

### Option C: Use railway.json (If Supported)
Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/web/Dockerfile"
  },
  "deploy": {
    "buildArgs": {
      "NEXT_PUBLIC_API_URL": "https://hos-marketplaceapi-production.up.railway.app/api",
      "NEXT_PUBLIC_CMS_URL": "",
      "NEXT_PUBLIC_FRONTEND_URL": "https://hos-marketplaceweb-production.up.railway.app"
    }
  }
}
```

## Step 3: Alternative Solution (If Build Args Don't Work)

If Railway doesn't support build args, we can use a build script:

1. Create `apps/web/build.sh`:
```bash
#!/bin/bash
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://hos-marketplaceapi-production.up.railway.app/api}
export NEXT_PUBLIC_CMS_URL=${NEXT_PUBLIC_CMS_URL:-}
export NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL:-https://hos-marketplaceweb-production.up.railway.app}
pnpm build
```

2. Update Dockerfile to use the script instead of direct `pnpm build`

## Step 4: Verify After Fix

1. Wait for deployment to complete
2. Open incognito window
3. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
4. Open DevTools → Network tab
5. Try login
6. Check network requests - should call Railway API URL, NOT localhost

## Current Status
✅ Dockerfile updated
✅ Code pushed to GitHub
⏳ Waiting for Railway deployment
⏳ Need to verify build logs show the env var

