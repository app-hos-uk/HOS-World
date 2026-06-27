# 🔧 Fix Railway API Deployment - CMD Parsing Error

## Problem
Railway is showing error: `/bin/sh: 1: [sh,: not found`

This error suggests Railway is having trouble parsing the Dockerfile CMD command.

## ✅ Fix Applied

### 1. Changed CMD from Exec Form to Shell Form

**Before:**
```dockerfile
CMD ["node", "dist/main.js"]
```

**After:**
```dockerfile
CMD node dist/main.js
```

### 2. Simplified Complex Shell Command

Removed the complex `sh -c` command that might have been causing parsing issues during build.

## 🚀 Next Steps

1. **Commit and push the fix:**
   ```bash
   git add services/api/Dockerfile
   git commit -m "fix: Change Dockerfile CMD to shell form to fix Railway parsing error"
   git push origin master
   ```

2. **Verify Railway Dashboard Settings:**
   - Go to Railway Dashboard → API Service → Settings → Deploy
   - Ensure "Custom Start Command" is **EMPTY** (let Dockerfile handle it)
   - If there's a start command, **DELETE IT**

3. **Monitor Deployment:**
   - Watch the deployment logs
   - The error should be resolved

## Why This Fixes It

- **Shell form CMD** (`CMD node dist/main.js`) is more compatible with Railway's parsing
- **Exec form** (`CMD ["node", "dist/main.js"]`) can sometimes be misinterpreted by Railway's Metal builder
- Removing complex shell commands reduces parsing complexity

## Verification

After deployment, check:
- ✅ Container starts without `[sh,` error
- ✅ Service responds to health checks
- ✅ API endpoints are accessible
