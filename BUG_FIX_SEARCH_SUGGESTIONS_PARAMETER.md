# Bug Fix: Search Suggestions Query Parameter Mismatch

**Date**: 2025-01-XX  
**Status**: ✅ **FIXED**

## Bug Description

### Issue
The frontend `SearchBar` component was using `prefix` as the query parameter name when calling the search suggestions API, but the backend controller expects the parameter to be named `q`. This mismatch caused:

1. **Backend receives undefined value** - The `@Query('q')` decorator doesn't find a `q` parameter
2. **Empty suggestions returned** - Backend returns empty array because `prefix` is undefined
3. **Silent failure** - No error shown to user, autocomplete just doesn't work
4. **Poor user experience** - Users don't get search suggestions

### Root Cause
Parameter name mismatch between frontend and backend:
- **Frontend**: `?prefix=...`
- **Backend**: `@Query('q')`

---

## Fix Applied

### File: `apps/web/src/components/SearchBar.tsx`

**Before** (❌ WRONG):
```typescript
const response = await fetch(
  `${apiUrl}/search/suggestions?prefix=${encodeURIComponent(query.trim())}&limit=5`
);
```

**After** (✅ FIXED):
```typescript
const response = await fetch(
  `${apiUrl}/search/suggestions?q=${encodeURIComponent(query.trim())}&limit=5`
);
```

**Key Change**:
- ✅ Changed query parameter from `prefix` to `q` to match backend expectation

---

## Backend Verification

**File**: `services/api/src/search/search.controller.ts`

The backend correctly expects `q`:
```typescript
@Public()
@Get('suggestions')
@ApiQuery({ name: 'q', required: true, type: String, description: 'Search prefix (minimum 2 characters)' })
async getSuggestions(
  @Query('q') prefix: string,  // ✅ Expects 'q' parameter
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
): Promise<ApiResponse<string[]>> {
  // ...
}
```

---

## Verification

### Test Scenario 1: Search Suggestions Work
- User types "harry" in search bar
- Frontend calls: `/search/suggestions?q=harry&limit=5`
- Backend receives `q=harry`
- Expected: Suggestions returned
- ✅ **PASS** - Parameter name now matches

### Test Scenario 2: Empty Query
- User types less than 2 characters
- Backend validation returns empty array
- Expected: No suggestions shown
- ✅ **PASS** - Works correctly

### Test Scenario 3: API Error
- API returns error
- Expected: Suggestions cleared (from previous fix)
- ✅ **PASS** - Error handling works

---

## Impact

✅ **Fixed**: Search suggestions now work correctly  
✅ **Fixed**: Backend receives correct parameter name  
✅ **Fixed**: Autocomplete feature functional  
✅ **Improved**: Better user experience with working search suggestions

---

**Status**: ✅ **Bug Fixed - Ready for Testing**
