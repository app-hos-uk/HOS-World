# Fix Railway Dockerfile Path Issue

## Current Error
```
couldn't locate the dockerfile at path services/api/Dockerfile in code archive
```

## Problem
Railway is configured to look for `services/api/Dockerfile`, but the build context might be wrong.

## Solution: Update Railway Dashboard Settings

### Option 1: Use Root Dockerfile (Recommended)

1. Go to Railway Dashboard → `@hos-marketplace/api` → **Settings** → **Build** tab

2. Set these values:
   - **Root Directory:** EMPTY (or `.` for repo root)
   - **Dockerfile Path:** `Dockerfile` (root level)
   - **Builder:** `DOCKERFILE`

3. Save changes

### Option 2: Use services/api/Dockerfile

1. Go to Railway Dashboard → `@hos-marketplace/api` → **Settings** → **Build** tab

2. Set these values:
   - **Root Directory:** EMPTY (repo root - NOT `services/api`)
   - **Dockerfile Path:** `services/api/Dockerfile`
   - **Builder:** `DOCKERFILE`

3. Save changes

## Why This Matters

- **Root Directory** = Where Railway starts the build (should be repo root for monorepo)
- **Dockerfile Path** = Path to Dockerfile relative to Root Directory

If Root Directory is `services/api` and Dockerfile Path is `services/api/Dockerfile`, Railway looks for `services/api/services/api/Dockerfile` which doesn't exist!

## Correct Configuration

**For Root Dockerfile:**
- Root Directory: (empty)
- Dockerfile Path: `Dockerfile`

**For services/api/Dockerfile:**
- Root Directory: (empty)  
- Dockerfile Path: `services/api/Dockerfile`

## After Fixing

1. Save settings in Railway dashboard
2. Railway will auto-redeploy
3. Wait for build to complete
4. Check deployment logs for success
