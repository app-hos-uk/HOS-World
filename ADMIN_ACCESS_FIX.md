# Fix: ADMIN Access Denied Error

## Problem
ADMIN users were getting "Access Denied" when trying to access seller dashboard (and potentially other dashboards).

## Root Cause
1. **Frontend**: `RouteGuard` component only checked if user role was in the `allowedRoles` array
   - Seller dashboard had: `allowedRoles={['B2C_SELLER', 'SELLER']}`
   - ADMIN was not included

2. **Backend**: `/dashboard/stats` endpoint only allowed: `@Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')`
   - ADMIN was not included in the roles list

## Solution

### 1. Frontend RouteGuard (`apps/web/src/components/RouteGuard.tsx`)
**Change**: Added ADMIN bypass logic
- ADMIN role now automatically has access to all dashboards
- Updated both checks in the component (useEffect and render)

```typescript
// Before
const hasRequiredRole = allowedRoles.includes(user.role);

// After
const hasRequiredRole = allowedRoles.includes(user.role) || user.role === 'ADMIN';
```

### 2. Backend Dashboard Controller (`services/api/src/dashboard/dashboard.controller.ts`)
**Changes**:
1. Added ADMIN to `/dashboard/stats` endpoint roles
2. Added ADMIN handling in the endpoint logic

```typescript
// Before
@Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')

// After
@Roles('SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN')
```

**Admin Handling**: When ADMIN accesses `/dashboard/stats`, returns admin dashboard data (since they're accessing from seller dashboard page, showing admin overview makes sense).

## Result
- ✅ ADMIN can now access all dashboards (frontend check passes)
- ✅ ADMIN can now call all dashboard API endpoints (backend check passes)
- ✅ ADMIN gets appropriate data when accessing different dashboards

## Testing
After deployment:
1. Login as ADMIN (`admin@hos.test`)
2. Navigate to `/seller/dashboard` - should work (no access denied)
3. Dashboard should load (may show admin dashboard data)
4. Same for other dashboards (procurement, fulfillment, etc.)

## Notes
- ADMIN role has full access to everything (as intended)
- Frontend RouteGuard bypass for ADMIN applies to all routes
- Backend has ADMIN in all dashboard endpoint roles already (procurement, fulfillment, catalog, marketing, finance all had ADMIN)


