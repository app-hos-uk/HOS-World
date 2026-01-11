# ✅ Fixed: Admin Dashboard 401 Error

## Problem
Admin dashboard was returning **401 Unauthorized** when trying to load data.

**Error:**
```
GET https://hos-marketplaceapi-production.up.railway.app/api/v1/admin/dashboard 401 (Unauthorized)
Error: Invalid or expired token
```

## Root Cause
**Wrong API endpoint URL!**

The frontend API client was calling:
- ❌ `/admin/dashboard` 

But the backend endpoint is actually:
- ✅ `/dashboard/admin`

## Fix Applied
**File:** `packages/api-client/src/client.ts`

**Changed:**
```typescript
// Before (WRONG)
async getAdminDashboardData(): Promise<ApiResponse<any>> {
  return this.request<ApiResponse<any>>('/admin/dashboard', {
    method: 'GET',
  });
}

// After (CORRECT)
async getAdminDashboardData(): Promise<ApiResponse<any>> {
  return this.request<ApiResponse<any>>('/dashboard/admin', {
    method: 'GET',
  });
}
```

## Verification
✅ Backend endpoint exists: `services/api/src/dashboard/dashboard.controller.ts:163`
- Route: `@Get('admin')` at `@Controller('dashboard')`
- Full path: `/dashboard/admin`
- Requires: ADMIN role
- Uses: JWT authentication

## Next Steps
1. ✅ Fix applied to `packages/api-client/src/client.ts`
2. ⏳ Deploy to Railway (Railway will build automatically)
3. 🔄 Test admin dashboard after deployment

## Testing After Deployment
1. Log in as ADMIN user
2. Navigate to `/admin/dashboard`
3. Dashboard should load without 401 error
4. Data should display correctly

## Note About Token Expiration
Even with this fix, if your token expired (after 15 minutes), you may still get a 401. In that case:
- Simply log in again to get a fresh token
- The refresh token mechanism should handle this automatically
