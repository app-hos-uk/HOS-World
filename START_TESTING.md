# 🧪 Phase 1 Testing - Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js and pnpm installed
- ✅ Database running and accessible
- ✅ Environment variables configured (`.env` file in `services/api/`)

---

## Step-by-Step Testing Instructions

### Step 1: Start API Server

**Terminal 1** - Open a new terminal and run:

```bash
cd services/api
pnpm dev
```

**Wait for**: 
- ✅ "Nest application successfully started"
- ✅ Server listening on port 3001
- ✅ Database connection established

**Expected Output**:
```
[Nest] INFO  [NestFactory] Starting Nest application...
[Nest] INFO  [InstanceLoader] DatabaseModule dependencies initialized
[Nest] INFO  [NestFactory] Nest application successfully started
[Nest] INFO  [Nest] Application is running on: http://localhost:3001
```

**Keep this terminal open** - The API server must stay running.

---

### Step 2: Start Frontend

**Terminal 2** - Open a NEW terminal and run:

```bash
cd apps/web
pnpm dev
```

**Wait for**:
- ✅ "Ready" message
- ✅ Server listening on port 3000

**Expected Output**:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

**Keep this terminal open** - The frontend must stay running.

---

### Step 3: Run Automated Tests

**Terminal 3** - Open a NEW terminal and run:

```bash
cd /Users/apple/Desktop/HOS-latest\ Sabu
./test-phase1-e2e.sh
```

**What it tests**:
- ✅ API health check
- ✅ API versioning (v1 endpoints)
- ✅ Legacy endpoint compatibility
- ✅ Promotions API endpoints
- ✅ Shipping API endpoints
- ✅ Swagger documentation

**Expected Output**:
```
🧪 Phase 1 E2E Test Suite
=========================
API URL: http://localhost:3001/api
Frontend URL: http://localhost:3000

📋 Test 1: API Health Check
---------------------------
✅ PASS: API health check

📋 Test 2: API Versioning
-------------------------
✅ PASS: v1 products endpoint accessible
✅ PASS: Legacy products endpoint still works

📊 Test Summary
=========================
Passed: 6
Failed: 0
Total: 6

✅ All tests passed!
```

**Note**: Some tests may show 401 (Unauthorized) if authentication is required - this is expected and indicates the endpoint exists.

---

### Step 4: Manual Testing

**Open Browser**: Navigate to `http://localhost:3000`

#### Test 4.1: Coupon Application

1. **Login** as a customer
   - Go to: `http://localhost:3000/login`
   - Use test credentials (or create account)

2. **Add Products to Cart**
   - Browse products: `http://localhost:3000/products`
   - Add items (ensure total > $50 for coupon testing)

3. **Navigate to Cart**
   - Go to: `http://localhost:3000/cart`
   - Verify items are displayed

4. **Apply Coupon**
   - Find "Have a coupon code?" section
   - Enter a test coupon code (create via API first)
   - Click "Apply"
   - ✅ Verify: Discount shown in green
   - ✅ Verify: Cart total updated
   - ✅ Verify: Success message displayed

5. **Test Invalid Coupon**
   - Enter invalid code: `INVALID123`
   - Click "Apply"
   - ✅ Verify: Error message displayed
   - ✅ Verify: Cart total unchanged

#### Test 4.2: Shipping Calculation

1. **Navigate to Checkout**
   - From cart page, click "Proceed to Checkout"
   - Or go to: `http://localhost:3000/checkout`

2. **Select Shipping Address**
   - Choose an existing address
   - Or add a new address

3. **Verify Shipping Options**
   - ✅ Shipping options appear automatically
   - ✅ Multiple methods listed (if configured)
   - ✅ Prices displayed for each method

4. **Select Shipping Method**
   - Click on a shipping method
   - ✅ Verify: Method is selected (highlighted)
   - ✅ Verify: Shipping cost shown in order summary

5. **Verify Order Total**
   - ✅ Subtotal displayed
   - ✅ Discount displayed (if coupon applied)
   - ✅ Shipping cost displayed
   - ✅ Total = Subtotal - Discount + Shipping

#### Test 4.3: Complete Checkout Flow

1. **Complete Checkout**
   - Select shipping address ✅
   - Select shipping method ✅
   - Click "Proceed to Payment" ✅

2. **Payment Page**
   - ✅ Order summary displayed
   - ✅ Payment providers listed
   - ✅ Select a payment provider
   - ✅ Complete payment (or test mode)

3. **Order Confirmation**
   - ✅ Redirected to order page
   - ✅ Order details correct
   - ✅ Totals match checkout

#### Test 4.4: API Versioning

1. **Check Swagger Documentation**
   - Navigate to: `http://localhost:3001/api/docs`
   - ✅ Swagger UI loads
   - ✅ Endpoints show `/api/v1/` prefix
   - ✅ Can test endpoints via Swagger

2. **Test v1 Endpoints**
   ```bash
   # In Terminal 3
   curl http://localhost:3001/api/v1/health
   curl http://localhost:3001/api/v1/products?page=1&limit=1
   ```

3. **Test Legacy Endpoints**
   ```bash
   curl http://localhost:3001/api/health
   curl http://localhost:3001/api/products?page=1&limit=1
   ```
   - ✅ Both should work (backward compatibility)

---

## Troubleshooting

### Issue: API Server Won't Start

**Check**:
1. Port 3001 is not in use: `lsof -ti:3001`
2. Database connection: Check `.env` file
3. Dependencies installed: `cd services/api && pnpm install`

**Solution**:
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Restart API server
cd services/api && pnpm dev
```

### Issue: Frontend Won't Start

**Check**:
1. Port 3000 is not in use: `lsof -ti:3000`
2. Dependencies installed: `cd apps/web && pnpm install`

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Restart frontend
cd apps/web && pnpm dev
```

### Issue: Tests Fail with 401 Unauthorized

**This is expected** for protected endpoints. The test verifies the endpoint exists, not that authentication works.

**To test authenticated endpoints**:
1. Get JWT token from browser (after login)
2. Set environment variable: `export ADMIN_TOKEN="your-jwt-token"`
3. Re-run tests: `./test-phase1-e2e.sh`

### Issue: "No shipping options available"

**Solution**:
1. Create shipping methods via API or admin panel
2. Ensure shipping methods are active
3. Check shipping rules are configured

### Issue: "Coupon validation failed"

**Solution**:
1. Create a promotion first via API
2. Create a coupon for that promotion
3. Ensure promotion is ACTIVE
4. Check promotion dates (not expired)
5. Verify minimum order amount is met

---

## Test Data Setup

### Create Test Promotion & Coupon

**Via Swagger** (`http://localhost:3001/api/docs`):

1. **Create Promotion**:
   - Endpoint: `POST /api/v1/promotions`
   - Body:
     ```json
     {
       "name": "Test 10% Off",
       "type": "PERCENTAGE",
       "status": "ACTIVE",
       "startDate": "2024-01-01T00:00:00Z",
       "endDate": "2024-12-31T23:59:59Z",
       "conditions": {
         "minimumOrderAmount": 50
       },
       "actions": {
         "discountType": "PERCENTAGE",
         "discountValue": 10
       }
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

3. **Test Coupon**:
   - Use code: `TEST10` in cart page
   - Should apply 10% discount

### Create Test Shipping Method

**Via Swagger** (`http://localhost:3001/api/docs`):

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

2. **Create Shipping Rule**:
   - Endpoint: `POST /api/v1/shipping/rules`
   - Body:
     ```json
     {
       "shippingMethodId": "<method-id-from-step-1>",
       "type": "FLAT_RATE",
       "rate": 5.99
     }
     ```

---

## Success Criteria

✅ **Phase 1 Testing is Complete When**:

1. ✅ All automated tests pass
2. ✅ Can create and apply coupons successfully
3. ✅ Shipping options calculate correctly
4. ✅ Complete checkout flow works end-to-end
5. ✅ All API endpoints accessible via `/api/v1/*`
6. ✅ Legacy endpoints still work
7. ✅ No critical errors in browser console
8. ✅ All calculations are correct

---

## Quick Reference

### Terminal Commands

```bash
# Check if servers are running
lsof -ti:3001  # API server
lsof -ti:3000  # Frontend

# Kill processes if needed
lsof -ti:3001 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Start servers
cd services/api && pnpm dev            # Terminal 1
cd apps/web && pnpm dev                # Terminal 2
./test-phase1-e2e.sh                  # Terminal 3
```

### URLs

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001/api
- **Swagger**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api/v1/health

---

## Next Steps After Testing

1. ✅ Review test results
2. ✅ Fix any issues found
3. ✅ Document any bugs
4. ✅ Update test plans if needed
5. ✅ Proceed to production deployment

---

**Ready to test?** Follow the steps above in order. Good luck! 🚀
