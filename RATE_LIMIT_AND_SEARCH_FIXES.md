# Rate Limiting and Search Service Fixes

## Changes Implemented

### 1. Exclude Health Endpoints from Rate Limiting ✅

**Problem:** Health check endpoints were being rate limited, preventing proper monitoring.

**Solution:**
- Created `CustomThrottlerGuard` that skips rate limiting for `/api/health*` endpoints
- Added `@SkipThrottle()` decorator to `HealthController` as additional protection
- Health endpoints now always accessible for monitoring

**Files Modified:**
- `services/api/src/rate-limit/custom-throttler.guard.ts` (new)
- `services/api/src/rate-limit/rate-limit.module.ts`
- `services/api/src/health/health.controller.ts`

**Implementation:**
```typescript
// CustomThrottlerGuard skips health endpoints
protected shouldSkip(context: ExecutionContext): boolean {
  const path = request.url || request.path;
  if (path && (path.startsWith('/api/health') || path.startsWith('/health'))) {
    return true;
  }
  return false;
}
```

---

### 2. Fix Search Service 500 Errors ✅

**Problem:** Search endpoint was returning 500 errors when Elasticsearch was unavailable or had issues.

**Solution:**
- Added database fallback when Elasticsearch fails
- Implemented graceful error handling
- Search now returns database results instead of throwing errors

**Files Modified:**
- `services/api/src/search/search.service.ts`

**Implementation:**
1. Check if Elasticsearch is configured before attempting search
2. If Elasticsearch fails, automatically fallback to database search
3. Return empty results if both fail (instead of 500 error)

**Fallback Logic:**
```typescript
// Check Elasticsearch availability
if (!elasticsearchNode) {
  return this.searchInDatabase(query, filters);
}

try {
  // Elasticsearch search
} catch (error) {
  // Fallback to database
  return this.searchInDatabase(query, filters);
}
```

**Database Search Features:**
- Text search in product name and description
- Filter by category, fandom, seller, price range, rating
- Pagination support
- Returns same format as Elasticsearch results

---

### 3. Optimize Rate Limits for Production ✅

**Problem:** Rate limit of 100 requests/minute was too restrictive for production traffic.

**Solution:**
- Increased default rate limit from 100 to 300 requests/minute
- Still configurable via `RATE_LIMIT_MAX` environment variable
- Health endpoints excluded from limits

**Files Modified:**
- `services/api/src/rate-limit/rate-limit.module.ts`

**Configuration:**
- **Before:** 100 requests/minute
- **After:** 300 requests/minute
- **Configurable:** Via `RATE_LIMIT_MAX` environment variable

---

## Expected Improvements

### 1. Health Monitoring
- ✅ Health endpoints always accessible
- ✅ No rate limiting interference
- ✅ Proper monitoring capabilities

### 2. Search Reliability
- ✅ No more 500 errors
- ✅ Graceful fallback to database
- ✅ Always returns results (even if empty)

### 3. Production Traffic
- ✅ Higher rate limits (300 req/min)
- ✅ Better handling of concurrent users
- ✅ Health endpoints excluded

---

## Testing Recommendations

### 1. Health Endpoints
```bash
# Should not be rate limited
curl https://hos-marketplaceapi-production.up.railway.app/api/health
curl https://hos-marketplaceapi-production.up.railway.app/api/health/ready
curl https://hos-marketplaceapi-production.up.railway.app/api/health/live
```

### 2. Search Service
```bash
# Should work even if Elasticsearch is down
curl https://hos-marketplaceapi-production.up.railway.app/api/search?q=wand
```

### 3. Rate Limiting
- Test normal endpoints (should rate limit at 300 req/min)
- Test health endpoints (should never rate limit)

---

## Environment Variables

### Rate Limiting
- `RATE_LIMIT_TTL` - Time window in milliseconds (default: 60000 = 1 minute)
- `RATE_LIMIT_MAX` - Max requests per window (default: 300)

### Search Service
- `ELASTICSEARCH_NODE` - Elasticsearch connection URL (optional)
- If not set, search will use database fallback

---

## Deployment Notes

1. **No Breaking Changes:** All changes are backward compatible
2. **Health Endpoints:** Now always accessible (no rate limiting)
3. **Search Service:** More resilient with database fallback
4. **Rate Limits:** Increased for production traffic

---

## Monitoring

After deployment, monitor:
1. Health endpoint accessibility (should be 100%)
2. Search endpoint error rate (should decrease)
3. Rate limit hit rate (should decrease with higher limits)
4. Response times (should remain fast)

---

**Status:** ✅ All fixes implemented and ready for deployment

