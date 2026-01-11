# Phase 1 End-to-End Test Plan

## Test Environment Setup

### Prerequisites
- API server running on `http://localhost:3001`
- Frontend running on `http://localhost:3000`
- Database with test data
- Test user accounts (Admin, Seller, Customer)

### Test Data
- Test products (various prices, weights)
- Test promotions (active, expired, usage-limited)
- Test coupons (valid, invalid, expired)
- Test shipping methods and rules
- Test addresses (various locations)

---

## Test Suite 1: Promotion Engine

### Test 1.1: Create and Apply Coupon
**Objective**: Verify coupon creation and application to cart

**Steps**:
1. Login as Admin
2. Create a promotion via API: `POST /api/v1/promotions`
   ```json
   {
     "name": "Test Promotion",
     "type": "PERCENTAGE",
     "status": "ACTIVE",
     "startDate": "2024-01-01T00:00:00Z",
     "endDate": "2024-12-31T23:59:59Z",
     "conditions": { "minimumOrderAmount": 50 },
     "actions": { "discountType": "PERCENTAGE", "discountValue": 10 }
   }
   ```
3. Create a coupon: `POST /api/v1/promotions/coupons`
   ```json
   {
     "promotionId": "<promotion-id>",
     "code": "TEST10",
     "usageLimit": 100
   }
   ```
4. Login as Customer
5. Add products to cart (total > $50)
6. Navigate to cart page
7. Enter coupon code "TEST10"
8. Apply coupon
9. Verify discount is applied (10% off)
10. Verify cart total is updated

**Expected Results**:
- ✅ Promotion created successfully
- ✅ Coupon created successfully
- ✅ Coupon code accepted
- ✅ Discount calculated correctly (10%)
- ✅ Cart total reflects discount
- ✅ Success message displayed

**Test Data**:
- Promotion ID: [To be captured]
- Coupon Code: TEST10
- Cart Total Before: [To be captured]
- Cart Total After: [To be captured]
- Discount Amount: [To be calculated]

---

### Test 1.2: Invalid Coupon Code
**Objective**: Verify error handling for invalid coupon codes

**Steps**:
1. Login as Customer
2. Add products to cart
3. Navigate to cart page
4. Enter invalid coupon code "INVALID123"
5. Apply coupon

**Expected Results**:
- ✅ Error message displayed
- ✅ Cart total unchanged
- ✅ Coupon input cleared or highlighted as error

---

### Test 1.3: Expired Coupon
**Objective**: Verify expired coupons are rejected

**Steps**:
1. Create promotion with past end date
2. Create coupon for expired promotion
3. Login as Customer
4. Add products to cart
5. Apply expired coupon code

**Expected Results**:
- ✅ Error message: "Coupon has expired"
- ✅ Cart total unchanged

---

### Test 1.4: Usage Limit Exceeded
**Objective**: Verify coupon usage limits are enforced

**Steps**:
1. Create coupon with usageLimit: 1
2. Apply coupon successfully (Test 1.1)
3. Logout
4. Login as different customer
5. Add products to cart
6. Apply same coupon code

**Expected Results**:
- ✅ Error message: "Coupon usage limit exceeded"
- ✅ Cart total unchanged

---

### Test 1.5: Minimum Order Amount
**Objective**: Verify promotion conditions are enforced

**Steps**:
1. Create promotion with minimumOrderAmount: 100
2. Create coupon for promotion
3. Login as Customer
4. Add products to cart (total < $100)
5. Apply coupon code

**Expected Results**:
- ✅ Error message: "Minimum order amount not met"
- ✅ Cart total unchanged

---

## Test Suite 2: Shipping Rules

### Test 2.1: Flat Rate Shipping
**Objective**: Verify flat rate shipping calculation

**Steps**:
1. Login as Admin/Seller
2. Create shipping method: `POST /api/v1/shipping/methods`
   ```json
   {
     "name": "Standard Shipping",
     "type": "FLAT_RATE",
     "isActive": true
   }
   ```
3. Create shipping rule: `POST /api/v1/shipping/rules`
   ```json
   {
     "shippingMethodId": "<method-id>",
     "type": "FLAT_RATE",
     "rate": 5.99
   }
   ```
4. Login as Customer
5. Add products to cart
6. Navigate to checkout
7. Select shipping address
8. View shipping options
9. Select "Standard Shipping"
10. Verify shipping cost: $5.99

**Expected Results**:
- ✅ Shipping method created
- ✅ Shipping rule created
- ✅ Shipping options displayed
- ✅ Flat rate $5.99 shown
- ✅ Order total includes shipping

**Test Data**:
- Shipping Method ID: [To be captured]
- Shipping Rule ID: [To be captured]
- Shipping Cost: $5.99

---

### Test 2.2: Weight-Based Shipping
**Objective**: Verify weight-based shipping calculation

**Steps**:
1. Create shipping method with type: "WEIGHT_BASED"
2. Create shipping rule:
   ```json
   {
     "type": "WEIGHT_BASED",
     "baseRate": 3.99,
     "ratePerKg": 1.50,
     "maxWeight": 30
   }
   ```
3. Add products to cart (total weight: 5kg)
4. Navigate to checkout
5. Select shipping address
6. View shipping options
7. Verify shipping cost: $3.99 + (5 * $1.50) = $11.49

**Expected Results**:
- ✅ Weight calculated correctly
- ✅ Shipping cost: $11.49
- ✅ Order total includes shipping

---

### Test 2.3: Free Shipping Threshold
**Objective**: Verify free shipping when threshold is met

**Steps**:
1. Create shipping rule with freeShippingThreshold: 100
2. Add products to cart (total: $120)
3. Navigate to checkout
4. Select shipping address
5. View shipping options
6. Verify "Free Shipping" option available

**Expected Results**:
- ✅ Free shipping option displayed
- ✅ Shipping cost: $0.00
- ✅ Order total excludes shipping

---

### Test 2.4: Distance-Based Shipping
**Objective**: Verify distance-based shipping calculation

**Steps**:
1. Create shipping method with type: "DISTANCE_BASED"
2. Create shipping rule:
   ```json
   {
     "type": "DISTANCE_BASED",
     "baseRate": 4.99,
     "ratePerKm": 0.50,
     "maxDistance": 50
   }
   ```
3. Add products to cart
4. Navigate to checkout
5. Select shipping address (distance: 10km from warehouse)
6. View shipping options
7. Verify shipping cost: $4.99 + (10 * $0.50) = $9.99

**Expected Results**:
- ✅ Distance calculated correctly
- ✅ Shipping cost: $9.99
- ✅ Order total includes shipping

---

### Test 2.5: No Shipping Options Available
**Objective**: Verify error handling when no shipping available

**Steps**:
1. Deactivate all shipping methods
2. Add products to cart
3. Navigate to checkout
4. Select shipping address
5. Attempt to view shipping options

**Expected Results**:
- ✅ Error message: "No shipping options available"
- ✅ Checkout cannot proceed
- ✅ Clear instructions displayed

---

## Test Suite 3: API Versioning

### Test 3.1: Versioned Endpoints Access
**Objective**: Verify v1 endpoints are accessible

**Steps**:
1. Test `GET /api/v1/health`
2. Test `GET /api/v1/products`
3. Test `POST /api/v1/auth/login`
4. Test `GET /api/v1/promotions`
5. Test `GET /api/v1/shipping/methods`

**Expected Results**:
- ✅ All v1 endpoints return 200 OK
- ✅ Responses match expected format
- ✅ No version-related errors

---

### Test 3.2: Legacy Endpoints Still Work
**Objective**: Verify backward compatibility

**Steps**:
1. Test `GET /api/health` (legacy)
2. Test `GET /api/products` (legacy)
3. Test `POST /api/auth/login` (legacy)

**Expected Results**:
- ✅ Legacy endpoints return 200 OK
- ✅ Responses match v1 format
- ✅ No breaking changes

---

### Test 3.3: Swagger Documentation
**Objective**: Verify Swagger shows versioned routes

**Steps**:
1. Navigate to `/api/docs`
2. Check for v1 endpoints
3. Verify all endpoints documented
4. Test "Try it out" for key endpoints

**Expected Results**:
- ✅ Swagger UI loads
- ✅ v1 endpoints visible
- ✅ Documentation complete
- ✅ "Try it out" works

---

## Test Suite 4: Complete Integration Flow

### Test 4.1: Full Checkout Flow with Promotions and Shipping
**Objective**: Verify complete cart → checkout → payment flow

**Steps**:
1. Login as Customer
2. Add products to cart (total: $75)
3. Apply coupon code (10% discount)
4. Verify cart total: $67.50
5. Navigate to checkout
6. Select shipping address
7. View shipping options
8. Select shipping method (cost: $5.99)
9. Verify order total: $73.49
10. Create order
11. Navigate to payment
12. Select payment provider
13. Complete payment
14. Verify order created with:
    - Subtotal: $75.00
    - Discount: -$7.50
    - Shipping: $5.99
    - Total: $73.49

**Expected Results**:
- ✅ All steps complete successfully
- ✅ All calculations correct
- ✅ Order created with correct totals
- ✅ Payment processed successfully

---

### Test 4.2: Error Recovery
**Objective**: Verify error handling and recovery

**Steps**:
1. Start checkout flow
2. Apply invalid coupon (should fail gracefully)
3. Continue with valid coupon
4. Shipping calculation fails (simulate)
5. Retry shipping calculation
6. Complete checkout

**Expected Results**:
- ✅ Errors handled gracefully
- ✅ User can recover from errors
- ✅ No data loss
- ✅ Flow can continue after errors

---

## Test Suite 5: Performance Testing

### Test 5.1: Shipping Calculation Performance
**Objective**: Verify shipping calculation is fast

**Steps**:
1. Measure time for shipping options API call
2. Test with various address combinations
3. Test with multiple shipping methods

**Expected Results**:
- ✅ Response time < 2 seconds
- ✅ No timeouts
- ✅ Consistent performance

---

### Test 5.2: Coupon Validation Performance
**Objective**: Verify coupon validation is fast

**Steps**:
1. Measure time for coupon validation API call
2. Test with various coupon codes
3. Test with expired/invalid coupons

**Expected Results**:
- ✅ Response time < 500ms
- ✅ No timeouts
- ✅ Consistent performance

---

## Test Execution Template

```markdown
### Test Execution Log

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Local/Staging/Production]

#### Test Results

| Test ID | Description | Status | Notes |
|---------|-------------|--------|-------|
| 1.1 | Create and Apply Coupon | ⬜ | |
| 1.2 | Invalid Coupon Code | ⬜ | |
| 1.3 | Expired Coupon | ⬜ | |
| 1.4 | Usage Limit Exceeded | ⬜ | |
| 1.5 | Minimum Order Amount | ⬜ | |
| 2.1 | Flat Rate Shipping | ⬜ | |
| 2.2 | Weight-Based Shipping | ⬜ | |
| 2.3 | Free Shipping Threshold | ⬜ | |
| 2.4 | Distance-Based Shipping | ⬜ | |
| 2.5 | No Shipping Options | ⬜ | |
| 3.1 | Versioned Endpoints | ⬜ | |
| 3.2 | Legacy Endpoints | ⬜ | |
| 3.3 | Swagger Documentation | ⬜ | |
| 4.1 | Full Checkout Flow | ⬜ | |
| 4.2 | Error Recovery | ⬜ | |
| 5.1 | Shipping Performance | ⬜ | |
| 5.2 | Coupon Performance | ⬜ | |

**Overall Status**: ⬜ Pass / ⬜ Fail / ⬜ Partial
**Issues Found**: [List any issues]
**Next Steps**: [Action items]
```

---

## Automated Test Scripts

### Prerequisites
```bash
# Install dependencies
cd services/api
pnpm install

# Start API server
pnpm start:dev

# In another terminal
cd apps/web
pnpm install
pnpm dev
```

### Manual Test Checklist
Use this checklist when running manual tests:

1. [ ] API server is running
2. [ ] Frontend is running
3. [ ] Database is accessible
4. [ ] Test user accounts exist
5. [ ] Test data is loaded
6. [ ] Browser console is open for debugging
7. [ ] Network tab is open for API monitoring

---

## Bug Reporting Template

```markdown
### Bug Report

**Test ID**: [e.g., 1.1]
**Severity**: [Critical/High/Medium/Low]
**Description**: [Brief description]

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**: [What should happen]
**Actual Result**: [What actually happened]
**Screenshots**: [If applicable]
**Console Errors**: [Any errors in browser console]
**API Response**: [If applicable]

**Environment**:
- Browser: [Chrome/Firefox/Safari]
- OS: [macOS/Windows/Linux]
- API Version: [Version]
- Frontend Version: [Version]
```

---

## Success Criteria

Phase 1 is considered complete when:

1. ✅ All backend features implemented
2. ✅ All API endpoints working
3. ✅ Frontend integration complete
4. ✅ 90%+ of E2E tests passing
5. ✅ Performance benchmarks met
6. ✅ Error handling verified
7. ✅ Documentation complete

---

**Last Updated**: [Date]
**Status**: Ready for Testing
