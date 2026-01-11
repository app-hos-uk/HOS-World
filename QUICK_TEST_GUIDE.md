# Quick Test Guide - Phase 1 Features

## Prerequisites

```bash
# Terminal 1: Start API server
cd services/api
pnpm start:dev

# Terminal 2: Start Frontend
cd apps/web
pnpm dev

# Terminal 3: Run automated tests (optional)
./test-phase1-e2e.sh
```

---

## Manual Testing Steps

### Test 1: Coupon Application (5 minutes)

1. **Login** as customer: `http://localhost:3000/login`
2. **Add products** to cart (total > $50)
3. **Navigate** to cart: `http://localhost:3000/cart`
4. **Enter coupon code** in the "Have a coupon code?" section
5. **Click "Apply"**
6. **Verify**:
   - ✅ Discount shown in green
   - ✅ Cart total updated
   - ✅ Success message displayed
   - ✅ Coupon code shown as "Applied"

**Test Coupon Codes** (create via API first):
- Valid: `TEST10` (10% off)
- Invalid: `INVALID123` (should show error)
- Expired: `EXPIRED` (should show error)

---

### Test 2: Shipping Calculation (5 minutes)

1. **Login** as customer
2. **Add products** to cart
3. **Navigate** to checkout: `http://localhost:3000/checkout`
4. **Select shipping address** (or add new one)
5. **Verify**:
   - ✅ Shipping options appear automatically
   - ✅ Shipping methods listed with prices
   - ✅ Can select shipping method
   - ✅ Order total includes shipping cost

**Expected Behavior**:
- Shipping options load within 2 seconds
- Multiple methods shown (if configured)
- Free shipping option if threshold met

---

### Test 3: Complete Checkout Flow (10 minutes)

1. **Add products** to cart
2. **Apply coupon** (optional)
3. **Go to checkout**
4. **Select shipping address**
5. **Select shipping method**
6. **Click "Proceed to Payment"**
7. **Select payment provider**
8. **Complete payment**
9. **Verify**:
   - ✅ Order created successfully
   - ✅ Order total includes: subtotal - discount + shipping
   - ✅ Order shows correct shipping method
   - ✅ Redirected to order confirmation

---

### Test 4: API Versioning (2 minutes)

1. **Open browser** to: `http://localhost:3001/api/docs`
2. **Verify**:
   - ✅ Swagger UI loads
   - ✅ Endpoints show `/api/v1/` prefix
   - ✅ Can test endpoints via Swagger

**Test Endpoints**:
```bash
# v1 endpoint
curl http://localhost:3001/api/v1/health

# Legacy endpoint (should still work)
curl http://localhost:3001/api/health
```

---

## API Testing (Using Swagger)

### Access Swagger UI
1. Navigate to: `http://localhost:3001/api/docs`
2. Login via Swagger (click "Authorize" button)
3. Enter JWT token from browser localStorage

### Test Promotions
1. **Create Promotion**:
   - Endpoint: `POST /api/v1/promotions`
   - Body:
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

2. **Create Coupon**:
   - Endpoint: `POST /api/v1/promotions/coupons`
   - Body:
     ```json
     {
       "promotionId": "<promotion-id-from-step-1>",
       "code": "TEST10",
       "usageLimit": 100
     }
     ```

3. **Validate Coupon**:
   - Endpoint: `POST /api/v1/promotions/coupons/validate`
   - Body: `{ "couponCode": "TEST10" }`

### Test Shipping
1. **Create Shipping Method**:
   - Endpoint: `POST /api/v1/shipping/methods`
   - Body:
     ```json
     {
       "name": "Standard Shipping",
       "type": "FLAT_RATE",
       "isActive": true
     }
     ```

2. **Calculate Shipping Options**:
   - Endpoint: `POST /api/v1/shipping/options`
   - Body:
     ```json
     {
       "cartItems": [
         { "productId": "<product-id>", "quantity": 2, "price": 25.00 }
       ],
       "cartValue": 50.00,
       "destination": {
         "country": "GB",
         "city": "London",
         "postalCode": "SW1A 1AA"
       }
     }
     ```

---

## Common Issues & Solutions

### Issue: "No payment providers available"
**Solution**: Check that payment providers are configured in environment variables:
- `STRIPE_SECRET_KEY`
- `KLARNA_USERNAME` / `KLARNA_PASSWORD`

### Issue: "No shipping options available"
**Solution**: Create shipping methods via API or admin panel first

### Issue: "Coupon validation failed"
**Solution**: 
- Ensure promotion is ACTIVE
- Check promotion dates (not expired)
- Verify minimum order amount is met
- Check usage limits

### Issue: API returns 401 Unauthorized
**Solution**: 
- Login first to get JWT token
- Include token in Authorization header: `Bearer <token>`
- Check token hasn't expired

---

## Success Criteria

✅ **Phase 1 is complete when**:
1. Can create and apply coupons successfully
2. Shipping options calculate correctly
3. Complete checkout flow works end-to-end
4. All API endpoints accessible via `/api/v1/*`
5. No critical errors in browser console
6. All calculations are correct

---

## Test Results Template

```markdown
### Test Execution Log

**Date**: [Date]
**Tester**: [Name]

| Feature | Test | Status | Notes |
|---------|------|--------|-------|
| Promotions | Coupon Application | ⬜ Pass / ⬜ Fail | |
| Promotions | Invalid Coupon | ⬜ Pass / ⬜ Fail | |
| Shipping | Shipping Calculation | ⬜ Pass / ⬜ Fail | |
| Shipping | Shipping Selection | ⬜ Pass / ⬜ Fail | |
| API Versioning | v1 Endpoints | ⬜ Pass / ⬜ Fail | |
| Integration | Complete Flow | ⬜ Pass / ⬜ Fail | |

**Issues Found**: [List any issues]
**Next Steps**: [Action items]
```

---

**Quick Start**: Run `./test-phase1-e2e.sh` for automated API tests, then use this guide for manual UI testing.
