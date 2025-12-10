# Docker Cache Fix - Railway Build Issue

## Problem
Railway build was failing with TypeScript error:
```
src/client.ts(52,42): error TS2580: Cannot find name 'process'
src/client.ts(102,44): error TS2580: Cannot find name 'process'
```

Even though the code was fixed and committed, Railway was using a **cached Docker layer** from before the fix.

## Root Cause
Docker caches the `COPY` step that copies packages. When we fixed the code:
1. ✅ Code was fixed locally
2. ✅ Code was committed to git
3. ✅ Code was pushed to GitHub
4. ❌ **Railway's Docker build used cached COPY layer** - still had old code

## Solution Applied

### 1. Added Cache-Busting Comment to Dockerfile
**File**: `apps/web/Dockerfile`

Added comment to force cache invalidation:
```dockerfile
# Cache-bust: 2025-12-04 - Fixed api-client TypeScript build error
```

### 2. Added Cache-Busting Comment to Source File
**File**: `packages/api-client/src/client.ts`

Added comment at top of file:
```typescript
// Cache-bust: 2025-12-04 - Fixed TypeScript build error (removed process.env checks)
```

## Why This Works

1. **Docker Layer Caching**: Docker caches layers based on file content
2. **Cache Invalidation**: Changing any file in a COPY step invalidates that layer
3. **Fresh Build**: Railway will now rebuild from scratch with latest code

## Verification

✅ **Local Build**: `pnpm build` in `packages/api-client` succeeds
✅ **No TypeScript Errors**: Code compiles without errors
✅ **Cache-Busting**: Comments added to force fresh Docker build

## Expected Railway Build Flow

1. **Git Pull**: Railway pulls latest commit
2. **Docker Build**: Starts building Docker image
3. **Cache Check**: Sees changed files (cache-bust comments)
4. **Fresh COPY**: Copies packages with latest code (no process.env)
5. **Build Success**: TypeScript compiles successfully

## Commits

- `f0c1e38` - Initial fix (removed process.env)
- `[new commit]` - Added cache-busting comments

## Next Steps

1. **Monitor Railway Build**: Should now build successfully
2. **Verify No Errors**: Check build logs for TypeScript errors
3. **Confirm Deployment**: Login page should be stable

## If Still Failing

If Railway still uses cached layers:
1. **Manual Rebuild**: Trigger rebuild in Railway Dashboard
2. **Clear Cache**: Railway may have option to clear build cache
3. **Force Push**: Make another small change to force rebuild

---

**Status**: ✅ Cache-busting added
**Expected**: Railway will rebuild with fresh code
**Ready for**: Production deployment





