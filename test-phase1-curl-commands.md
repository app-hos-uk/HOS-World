# Phase 1 Testing - curl Commands

Quick reference for testing Phase 1 endpoints using curl.

## Prerequisites

Ensure API server is running:
```bash
cd services/api
pnpm dev
```

---

## Test 1: API Health Check

```bash
# v1 endpoint
curl http://localhost:3001/api/v1/health

# Legacy endpoint
curl http://localhost:3001/api/health
```

**Expected**: `{"status":"ok",...}` or `200 OK`

---

## Test 2: API Versioning

```bash
# v1 products endpoint
curl http://localhost:3001/api/v1/products?page=1&limit=1

# Legacy products endpoint
curl http://localhost:3001/api/products?page=1&limit=1

# v1 root endpoint
curl http://localhost:3001/api/v1

# Legacy root endpoint
curl http://localhost:3001/api
```

**Expected**: Both should return data (may require auth for products)

---

## Test 3: Promotions API

```bash
# List promotions (requires auth)
curl http://localhost:3001/api/v1/promotions

# List active promotions
curl http://localhost:3001/api/v1/promotions?status=ACTIVE

# Validate coupon (requires auth)
curl -X POST http://localhost:3001/api/v1/promotions/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"couponCode":"TEST10"}'
```

**Expected**: 
- `200 OK` or `401 Unauthorized` (if auth required)
- For validate: `{"data":{...},"message":"..."}`

---

## Test 4: Shipping API

```bash
# List shipping methods (requires auth)
curl http://localhost:3001/api/v1/shipping/methods

# Calculate shipping options
curl -X POST http://localhost:3001/api/v1/shipping/options \
  -H "Content-Type: application/json" \
  -d '{
    "cartItems": [
      {"productId": "test-id", "quantity": 2, "price": 25.00}
    ],
    "cartValue": 50.00,
    "destination": {
      "country": "GB",
      "city": "London",
      "postalCode": "SW1A 1AA"
    }
  }'
```

**Expected**: 
- `200 OK` or `401 Unauthorized` (if auth required)
- For options: `{"data":[...],"message":"..."}`

---

## Test 5: API Documentation

```bash
# Swagger UI
curl -I http://localhost:3001/api/docs

# Swagger JSON
curl http://localhost:3001/api/docs-json
```

**Expected**: 
- Swagger UI: `200 OK` (HTML)
- Swagger JSON: `200 OK` (JSON)

---

## Test 6: Authenticated Endpoints (with token)

If you have a JWT token:

```bash
# Set your token
TOKEN="your-jwt-token-here"

# Test authenticated endpoints
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/promotions

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/shipping/methods

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/cart
```

---

## Automated Test Script

Run all tests at once:

```bash
./test-phase1-curl.sh
```

This script will:
- ✅ Test all endpoints
- ✅ Handle authentication gracefully
- ✅ Show pass/fail for each test
- ✅ Provide summary at the end

---

## Quick Verification

Before running tests, verify server is running:

```bash
# Check API health
curl http://localhost:3001/api/v1/health

# Should return: {"status":"ok",...}
```

If this fails:
1. Start API server: `cd services/api && pnpm dev`
2. Wait 10-15 seconds for server to start
3. Try again

---

## Expected Results

### ✅ Success
- All public endpoints return `200 OK`
- Protected endpoints return `401 Unauthorized` (expected)
- Versioned endpoints work
- Legacy endpoints still work

### ❌ Failure
- `Connection refused` - Server not running
- `404 Not Found` - Endpoint doesn't exist
- `500 Internal Server Error` - Server error (check logs)

---

## Troubleshooting

### Connection Refused
```bash
# Check if server is running
lsof -ti:3001

# Start server
cd services/api && pnpm dev
```

### 401 Unauthorized
This is **expected** for protected endpoints. To test with auth:
1. Login via frontend or API
2. Get JWT token from response
3. Use token in `Authorization: Bearer <token>` header

### 404 Not Found
Check:
1. Endpoint URL is correct
2. API versioning is enabled
3. Route is registered in controller

---

## Full Test Output Example

```bash
$ ./test-phase1-curl.sh

🧪 Phase 1 E2E Test Suite (curl-based)
=======================================
API URL: http://localhost:3001/api
Base URL: http://localhost:3001

📋 Test 1: API Health Check
---------------------------
Testing: API v1 health check
URL: GET http://localhost:3001/api/v1/health
Status: 200
✅ PASS: API v1 health check

📋 Test 2: API Versioning
-------------------------
Testing: v1 products endpoint
URL: GET http://localhost:3001/api/v1/products?page=1&limit=1
Status: 401
⏭️  SKIP: v1 products endpoint (requires authentication)

...

📊 Test Summary
=======================================
Passed: 6
Failed: 0
Skipped: 2
Total: 8

✅ All accessible tests passed!
ℹ️  Some tests were skipped (require authentication)
   This is expected for protected endpoints.
```

---

**Ready to test?** Run `./test-phase1-curl.sh` or use individual curl commands above! 🚀
