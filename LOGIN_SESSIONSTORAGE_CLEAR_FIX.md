# Login SessionStorage Clear Fix

## Issue
After successful login, the login page was showing "Redirect already in progress (from sessionStorage), skipping auth check" message, indicating the sessionStorage flag was persisting after login.

## Root Cause
The `sessionStorage.setItem('login_redirecting', 'true')` flag set during the auth check was not being cleared after successful login. This caused:
1. User logs in successfully
2. Redirect to home page happens
3. If user navigates back to login page, sessionStorage flag still exists
4. Auth check sees the flag and skips, showing the message

## Solution Applied

### 1. Clear SessionStorage After Successful Login
**Added to `handleLogin`:**
```typescript
// CRITICAL: Clear any existing sessionStorage redirect flags
// This prevents the auth check from interfering with the login redirect
try {
  sessionStorage.removeItem('login_redirecting');
} catch (e) {
  // Ignore sessionStorage errors
}
```

**Why**: Clears the flag set by the auth check, allowing fresh login flow.

### 2. Clear SessionStorage After Successful Registration
**Added to `handleRegister`:**
```typescript
// CRITICAL: Clear any existing sessionStorage redirect flags
try {
  sessionStorage.removeItem('login_redirecting');
} catch (e) {
  // Ignore sessionStorage errors
}
```

**Why**: Ensures registration flow also clears the flag.

### 3. Use Consistent Redirect Method
**Changed from:**
```typescript
setTimeout(() => {
  router.replace('/');
}, 0);
```

**To:**
```typescript
// Use window.location.replace() for immediate, reliable redirect
if (typeof window !== 'undefined') {
  window.location.replace('/');
} else {
  router.replace('/');
}
```

**Why**: Matches the auth check redirect behavior and ensures immediate redirect.

### 4. Set Redirect Flags Before Redirecting
**Added:**
```typescript
// Set redirect flag to prevent any auth re-checks
isRedirecting.current = true;
setIsCheckingAuth(false);
setLoading(false);
```

**Why**: Prevents any auth checks from running during the redirect.

## Changes Made

**File**: `apps/web/src/app/login/page.tsx`

1. ✅ Clear sessionStorage flag after successful login
2. ✅ Clear sessionStorage flag after successful registration
3. ✅ Use `window.location.replace()` for consistent redirect
4. ✅ Set redirect flags before redirecting
5. ✅ Set loading state to false before redirect

## Expected Results

### Before Fix
- ❌ Login successful
- ❌ Redirect to home
- ❌ If navigate back to login: "Redirect already in progress" message
- ❌ SessionStorage flag persists

### After Fix
- ✅ Login successful
- ✅ SessionStorage flag cleared
- ✅ Immediate redirect to home
- ✅ If navigate back to login: Normal login page (no message)
- ✅ Fresh auth check runs if needed

## Flow After Fix

1. **User logs in**:
   - Token saved to localStorage
   - SessionStorage flag cleared
   - Redirect flags set
   - Immediate redirect to home

2. **User navigates back to login**:
   - No sessionStorage flag exists
   - Auth check runs normally
   - If token exists: Redirect to home
   - If no token: Show login form

3. **User logs in again**:
   - Fresh login flow
   - No interference from previous sessionStorage flags
   - Clean redirect experience

## Testing

1. **Login with valid credentials**:
   - Should redirect to home immediately
   - No "Redirect already in progress" message
   - SessionStorage flag should be cleared

2. **Navigate back to login page**:
   - Should show normal login page
   - No sessionStorage interference
   - Auth check should run normally

3. **Login again**:
   - Should work normally
   - No sessionStorage conflicts
   - Clean redirect

## Commits

- `[commit hash]` - Fix: Clear sessionStorage flag after successful login/register

---

**Status**: ✅ Fixed
**Ready for**: Production deployment
**Expected**: Clean login flow without sessionStorage interference


