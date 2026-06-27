# Build Fix - apiBaseUrl.ts Missing

## Issue

Build failed with error:
```
Module not found: Can't resolve '@/lib/apiBaseUrl'
```

## Root Cause

The file `apps/web/src/lib/apiBaseUrl.ts` exists in the filesystem but was not tracked by git, so it wasn't included in the deployment.

## Fix Applied

Added `apiBaseUrl.ts` to git and pushed the fix.

## Files Added

- `apps/web/src/lib/apiBaseUrl.ts` - API URL normalization helper

## Deployment Status

✅ Fixed and pushed - Railway will rebuild automatically
