# Login Page Redirect Loop Fix

## Issue
The login page was automatically refreshing and redirecting back to the home page when users tried to access it, creating an unstable experience.

## Root Cause
1. **Invalid Token Check**: The `useEffect` hook was checking for any token in localStorage without validating it
2. **Always Redirecting**: Even when the token was invalid/expired, the code would still redirect to home page
3. **Redirect Loop**: The API client's `onUnauthorized` callback would redirect to login, but the login page would also redirect, creating a loop

## Solution Implemented

### 1. Proper Token Validation
- Added async token validation using `apiClient.getCurrentUser()`
- Only redirects if token is **valid** and user is authenticated
- If token is invalid, it's cleared and user stays on login page

### 2. Loading State
- Added `isCheckingAuth` state to prevent multiple redirects
- Shows loading spinner while checking authentication
- Prevents flickering and multiple redirect attempts

### 3. Prevent Redirect Loops
- Updated `api.ts` to check if already on login page before redirecting
- Prevents infinite redirect loops

### 4. Error Handling
- Invalid tokens are automatically cleared
- User stays on login page if token is invalid
- No automatic redirects on errors

## Changes Made

### `apps/web/src/app/login/page.tsx`
- Added `isCheckingAuth` state
- Improved `useEffect` to properly validate tokens
- Added loading state UI
- Only redirects if token is valid

### `apps/web/src/lib/api.ts`
- Updated `onUnauthorized` to check current pathname
- Prevents redirect loops by not redirecting if already on login page

## Testing

### Test Case 1: Valid Token
1. User logs in successfully
2. Token is stored in localStorage
3. User navigates to `/login`
4. **Expected**: Redirects to home page (user is authenticated)

### Test Case 2: Invalid/Expired Token
1. User has expired/invalid token in localStorage
2. User navigates to `/login`
3. **Expected**: Token is cleared, user stays on login page

### Test Case 3: No Token
1. User has no token in localStorage
2. User navigates to `/login`
3. **Expected**: Login page displays normally

### Test Case 4: API Error
1. API is down or returns error
2. User navigates to `/login` with token
3. **Expected**: Token is cleared, user stays on login page

## Behavior After Fix

✅ **Stable Login Page**: No more automatic redirects
✅ **Proper Validation**: Only redirects if user is actually authenticated
✅ **No Loops**: Prevents redirect loops
✅ **Better UX**: Shows loading state during auth check
✅ **Error Handling**: Invalid tokens are cleared automatically

## Code Flow

```
User navigates to /login
    ↓
useEffect runs
    ↓
Check localStorage for token
    ↓
If no token → Stay on login page
    ↓
If token exists → Validate with API
    ↓
If valid → Redirect to home
    ↓
If invalid → Clear token, stay on login
```

## Files Modified

1. `apps/web/src/app/login/page.tsx` - Main login page component
2. `apps/web/src/lib/api.ts` - API client configuration

---

**Status**: ✅ Fixed
**Date**: 2025-12-04





