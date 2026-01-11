# Phase 1 Testing Execution Guide

## 🎯 Overview

This guide provides step-by-step instructions for testing all Phase 1 features:
1. **Promotion Engine** - Coupon creation, validation, and application
2. **Shipping Rules** - Shipping method configuration and rate calculation
3. **API Versioning** - v1 endpoints and backward compatibility

---

## 📋 Prerequisites

- ✅ API server running on `http://localhost:3001`
- ✅ Frontend server running on `http://localhost:3000` (optional for API tests)
- ✅ Database connected and migrated
- ✅ Test user accounts created (Admin, Customer)

---

## 🚀 Quick Start

### Step 1: Start API Server

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```

**Wait for**: `✅ Server is listening on port 3001`

### Step 2: Verify API Health

**In a new terminal**:

```bash
curl http://localhost:3001/api/v1/health
```

**Expected**: JSON response with `"status":"ok"`

### Step 3: Run Automated Tests

**Option A: Curl-based API Tests** (No authentication required for public endpoints):

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
chmod +x test-phase1-curl.sh
./test-phase1-curl.sh
```

**Option B: Full E2E Tests** (Requires authentication):

```bash
chmod +x test-phase1-e2e.sh
./test-phase1-e2e.sh
```

**Option C: Playwright Browser Tests** (Requires both servers):

```bash
cd apps/web
pnpm test:e2e
```

---

## 🧪 Test Suite 1: API Versioning

### Test 1.1: Versioned Endpoints

```bash
# Test v1 endpoint
curl http://localhost:3001/api/v1/products?page=1&limit=1

# Test legacy endpoint (should still work)
curl http://localhost:3001/api/products?page=1&limit=1

# Test v1 root
curl http://localhost:3001/api/v1

# Test legacy root
curl http://localhost:3001/api
```

**Expected Results**:
- ✅ Both v1 and legacy endpoints return 200 or 401 (if auth required)
- ✅ Response structure is consistent
- ✅ v1 endpoints are accessible

### Test 1.2: Swagger Documentation

```bash
# Open in browser
open http://localhost:3001/api/docs

# Or test via curl
curl http://localhost:3001/api/docs
```

**Expected Results**:
- ✅ Swagger UI loads successfully
- ✅ All v1 endpoints are documented
- ✅ Legacy endpoints are documented

---

## 🧪 Test Suite 2: Promotion Engine

### Test 2.1: List Promotions (Public)

```bash
curl http://localhost:3001/api/v1/promotions
```

**Expected**: Array of promotions or empty array `[]`

### Test 2.2: Validate Coupon (Public)

```bash
curl -X POST http://localhost:3001/api/v1/promotions/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"couponCode":"TEST10"}'
```

**Expected**: 
- ✅ Returns validation result
- ✅ Handles invalid codes gracefully
- ✅ Returns appropriate error messages

### Test 2.3: Create Promotion (Requires Auth)

**First, get an admin token**:

```bash
# Login as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Test123!"
  }'
```

**Save the token**, then:

```bash
# Create promotion
curl -X POST http://localhost:3001/api/v1/promotions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Test Promotion",
    "type": "PERCENTAGE",
    "status": "ACTIVE",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "discountType": "PERCENTAGE",
    "discountValue": 10,
    "minimumOrderAmount": 50
  }'
```

**Expected**:
- ✅ Promotion created successfully
- ✅ Returns promotion ID
- ✅ Status is ACTIVE

### Test 2.4: Create Coupon (Requires Auth)

```bash
curl -X POST http://localhost:3001/api/v1/promotions/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "promotionId": "PROMOTION_ID_FROM_2.3",
    "code": "TEST10",
    "usageLimit": 100
  }'
```

**Expected**:
- ✅ Coupon created successfully
- ✅ Code is unique
- ✅ Linked to promotion

### Test 2.5: Apply Coupon to Cart (Requires Auth)

```bash
# First, get customer token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "Test123!"
  }'

# Apply coupon
curl -X POST http://localhost:3001/api/v1/promotions/coupons/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CUSTOMER_TOKEN_HERE" \
  -d '{
    "cartId": "CART_ID",
    "couponCode": "TEST10"
  }'
```

**Expected**:
- ✅ Coupon applied successfully
- ✅ Cart discount updated
- ✅ Cart total reflects discount

---

## 🧪 Test Suite 3: Shipping Rules

### Test 3.1: List Shipping Methods (Public)

```bash
curl http://localhost:3001/api/v1/shipping/methods
```

**Expected**: Array of shipping methods or empty array `[]`

### Test 3.2: Calculate Shipping Options (Public)

```bash
curl -X POST http://localhost:3001/api/v1/shipping/options \
  -H "Content-Type: application/json" \
  -d '{
    "cartItems": [
      {
        "productId": "PRODUCT_ID",
        "quantity": 2,
        "price": 25.00
      }
    ],
    "cartValue": 50.00,
    "destination": {
      "country": "GB",
      "state": "England",
      "city": "London",
      "postalCode": "SW1A 1AA"
    }
  }'
```

**Expected**:
- ✅ Returns available shipping options
- ✅ Rates calculated correctly
- ✅ Methods filtered by destination

### Test 3.3: Create Shipping Method (Requires Auth)

```bash
curl -X POST http://localhost:3001/api/v1/shipping/methods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -d '{
    "name": "Standard Shipping",
    "description": "Standard 3-5 day delivery",
    "isActive": true,
    "sellerId": "SELLER_ID"
  }'
```

**Expected**:
- ✅ Shipping method created
- ✅ Returns method ID
- ✅ Can be retrieved via GET

### Test 3.4: Create Shipping Rule (Requires Auth)

```bash
curl -X POST http://localhost:3001/api/v1/shipping/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -d '{
    "shippingMethodId": "METHOD_ID_FROM_3.3",
    "type": "FLAT_RATE",
    "conditions": {
      "minWeight": 0,
      "maxWeight": 10,
      "countries": ["GB"]
    },
    "rate": 5.99,
    "isActive": true
  }'
```

**Expected**:
- ✅ Rule created successfully
- ✅ Linked to shipping method
- ✅ Conditions stored correctly

---

## 🧪 Test Suite 4: Frontend Integration

### Test 4.1: Cart Page - Coupon Application

1. **Start frontend** (if not running):
   ```bash
   cd apps/web
   pnpm dev
   ```

2. **Navigate to**: `http://localhost:3000/cart`

3. **Steps**:
   - Add products to cart (total > $50)
   - Enter coupon code "TEST10"
   - Click "Apply Coupon"
   - Verify discount appears
   - Verify cart total updates

**Expected**:
- ✅ Coupon input field visible
- ✅ Apply button works
- ✅ Success message displayed
- ✅ Discount calculated correctly
- ✅ Cart total updated

### Test 4.2: Checkout Page - Shipping Selection

1. **Navigate to**: `http://localhost:3000/checkout`

2. **Steps**:
   - Select shipping address
   - Verify shipping options appear
   - Select a shipping method
   - Verify shipping cost updates
   - Verify order total includes shipping

**Expected**:
- ✅ Shipping options load
- ✅ Rates displayed correctly
- ✅ Selection updates total
- ✅ Tax calculated (if applicable)

### Test 4.3: Payment Page - Provider Selection

1. **Navigate to**: `http://localhost:3000/payment?orderId=ORDER_ID`

2. **Steps**:
   - Verify payment providers listed
   - Select a provider (Stripe/Klarna)
   - Verify provider-specific UI appears
   - Test gift card application (optional)

**Expected**:
- ✅ Payment providers loaded
- ✅ Provider selection works
- ✅ Payment flow initiates correctly

---

## 🧪 Test Suite 5: Playwright E2E Tests

### Run All Tests

```bash
cd apps/web
pnpm test:e2e
```

### Run Specific Test File

```bash
pnpm test:e2e e2e/cart-checkout-payment.spec.ts
```

### Run in UI Mode (Recommended for debugging)

```bash
pnpm test:e2e:ui
```

### Run in Headed Mode (See browser)

```bash
pnpm test:e2e:headed
```

---

## 📊 Test Results Checklist

### API Versioning
- [ ] v1 endpoints accessible
- [ ] Legacy endpoints still work
- [ ] Swagger docs available
- [ ] Versioning configured correctly

### Promotion Engine
- [ ] Promotions can be created
- [ ] Coupons can be created
- [ ] Coupon validation works
- [ ] Coupon application to cart works
- [ ] Discount calculation correct
- [ ] Error handling for invalid codes

### Shipping Rules
- [ ] Shipping methods can be created
- [ ] Shipping rules can be created
- [ ] Rate calculation works
- [ ] Options filtered by destination
- [ ] Multiple methods supported

### Frontend Integration
- [ ] Cart page shows coupon input
- [ ] Coupon application works
- [ ] Checkout shows shipping options
- [ ] Shipping selection works
- [ ] Payment page shows providers
- [ ] Provider selection works

---

## 🐛 Troubleshooting

### API Server Not Responding

```bash
# Check if server is running
lsof -i :3001

# Check server logs
tail -f services/api/logs/*.log
```

### Tests Failing with 401

- Ensure you're using a valid auth token
- Check token expiration
- Verify user has required permissions

### Tests Failing with 404

- Verify endpoint paths are correct
- Check API versioning is enabled
- Ensure routes are registered

### Frontend Tests Failing

- Ensure both API and frontend servers are running
- Check `NEXT_PUBLIC_API_URL` is set correctly
- Verify CORS is configured

---

## 📝 Test Data Setup

### Create Test Users

```bash
# Create admin user
curl -X POST http://localhost:3001/api/admin/create-team-users

# Create business users
curl -X POST http://localhost:3001/api/admin/create-business-users
```

### Create Test Products

Use Swagger UI at `http://localhost:3001/api/docs` to create test products.

---

## ✅ Success Criteria

All Phase 1 features are considered complete when:

1. ✅ All API endpoints return expected responses
2. ✅ Versioning works for both v1 and legacy endpoints
3. ✅ Promotions can be created and applied
4. ✅ Shipping rules can be configured and calculated
5. ✅ Frontend integrates with all new endpoints
6. ✅ E2E tests pass (or have acceptable failures for auth-required endpoints)

---

## 🎉 Next Steps

After completing Phase 1 testing:

1. Document any issues found
2. Fix critical bugs
3. Update test coverage
4. Proceed to Phase 2 features

---

**Last Updated**: 2026-01-08
**Status**: Ready for execution
