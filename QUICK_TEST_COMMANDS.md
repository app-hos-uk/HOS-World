# Quick Test Commands Reference

## 🚀 One-Line Test Commands

### Test API Health
```bash
curl http://localhost:3001/api/v1/health
```

### Test API Versioning
```bash
# v1 endpoint
curl http://localhost:3001/api/v1/products?page=1&limit=1

# Legacy endpoint
curl http://localhost:3001/api/products?page=1&limit=1
```

### Test Promotions
```bash
# List promotions
curl http://localhost:3001/api/v1/promotions

# Validate coupon
curl -X POST http://localhost:3001/api/v1/promotions/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"couponCode":"TEST10"}'
```

### Test Shipping
```bash
# List shipping methods
curl http://localhost:3001/api/v1/shipping/methods

# Calculate shipping
curl -X POST http://localhost:3001/api/v1/shipping/options \
  -H "Content-Type: application/json" \
  -d '{"cartItems":[],"cartValue":0,"destination":{"country":"GB"}}'
```

### Run Automated Test Scripts

```bash
# Curl-based tests (no auth required)
cd "/Users/apple/Desktop/HOS-latest Sabu"
./test-phase1-curl.sh

# Full E2E tests (may require auth)
./test-phase1-e2e.sh

# Playwright browser tests
cd apps/web
pnpm test:e2e
```

### Open Swagger Documentation
```bash
open http://localhost:3001/api/docs
# Or visit in browser: http://localhost:3001/api/docs
```

---

## 📋 Test Checklist

Run these in order:

1. ✅ API Health Check
2. ✅ API Versioning (v1 + legacy)
3. ✅ Promotions Endpoints
4. ✅ Shipping Endpoints
5. ✅ Swagger Documentation
6. ✅ Frontend Integration (if frontend running)
7. ✅ Playwright E2E Tests

---

## 🔑 Authentication (For Protected Endpoints)

### Get Admin Token
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Test123!"}' \
  | jq -r '.data.accessToken')

echo "Token: $TOKEN"
```

### Use Token in Requests
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/promotions
```

---

## 🐛 Quick Troubleshooting

### Server Not Running?
```bash
# Check if API is running
lsof -i :3001

# Start API server
cd services/api && pnpm dev
```

### Tests Failing?
1. Check API server is running: `curl http://localhost:3001/api/v1/health`
2. Check server logs for errors
3. Verify database connection
4. Check environment variables

---

**For detailed instructions, see**: `PHASE_1_TESTING_EXECUTION.md`
