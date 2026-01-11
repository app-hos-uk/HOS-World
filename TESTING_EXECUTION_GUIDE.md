# Phase 1 & Phase 2 Testing Execution Guide

## Quick Start

### Prerequisites
1. **API Server Running**: Start the backend API
   ```bash
   cd services/api
   pnpm start:dev
   ```

2. **Frontend Server Running** (for E2E tests):
   ```bash
   cd apps/web
   pnpm dev
   ```

3. **Database**: Ensure database is migrated and seeded
   ```bash
   cd services/api
   pnpm db:push
   pnpm db:seed-all-roles  # Creates test users
   ```

### Test Users
The test scripts expect these users to exist:
- **Admin**: `admin@hos.com` / `Test123!`
- **Customer**: `customer@hos.com` / `Test123!`

Create them if needed:
```bash
cd services/api
pnpm db:create-team-users
```

---

## Running Tests

### Option 1: Run All Tests (Recommended)
```bash
./run-all-phase-tests.sh
```

This will run all Phase 1 and Phase 2 tests in sequence.

### Option 2: Run Individual Test Suites

#### Phase 1 Tests
```bash
# Promotion Engine
./test-phase1-promotions.sh

# Shipping Rules
./test-phase1-shipping.sh
```

#### Phase 2 Tests
```bash
# Customer Groups
./test-phase2-customer-groups.sh

# Return Policies
./test-phase2-return-policies.sh

# Return Requests
./test-phase2-return-requests.sh
```

### Option 3: Playwright E2E Tests
```bash
cd apps/web
pnpm test:e2e
```

Or run the specific Phase 1 & Phase 2 E2E tests:
```bash
cd apps/web
pnpm exec playwright test phase1-phase2-e2e.spec.ts
```

---

## Test Coverage

### Phase 1: Promotion Engine
- ✅ Create promotions (percentage, fixed, free shipping)
- ✅ Create coupons
- ✅ Validate coupons
- ✅ Apply coupons to cart
- ✅ Promotion priority handling
- ✅ Promotion conditions

### Phase 1: Shipping Rules
- ✅ Create shipping methods
- ✅ Create shipping rules
- ✅ Calculate shipping rates
- ✅ Get shipping options
- ✅ Weight-based shipping
- ✅ Free shipping threshold

### Phase 2: Customer Groups
- ✅ Create customer groups
- ✅ Get all customer groups
- ✅ Update customer groups
- ✅ Add/remove customers from groups

### Phase 2: Return Policies
- ✅ Create return policies
- ✅ Get all return policies
- ✅ Update return policies
- ✅ Get applicable policy for product

### Phase 2: Return Requests
- ✅ Check return eligibility
- ✅ Create return requests
- ✅ Get return requests
- ✅ Update return status (admin)

---

## Manual Testing Checklist

### Phase 1: Frontend Integration

#### Promotion Engine
- [ ] Cart page shows coupon input field
- [ ] Coupon code can be entered
- [ ] Valid coupon shows success message
- [ ] Invalid coupon shows error message
- [ ] Discount is applied to cart total
- [ ] Discount breakdown is visible
- [ ] Coupon can be removed
- [ ] Cart total recalculates after coupon removal

#### Shipping Rules
- [ ] Checkout page shows shipping options
- [ ] Shipping rates are calculated correctly
- [ ] Free shipping threshold works
- [ ] Shipping method can be selected
- [ ] Shipping cost is included in order total

### Phase 2: Admin UIs

#### Customer Groups
- [ ] Navigate to `/admin/customer-groups`
- [ ] View all customer groups
- [ ] Create new customer group
- [ ] Edit existing customer group
- [ ] Deactivate customer group
- [ ] View customer count per group

#### Return Policies
- [ ] Navigate to `/admin/return-policies`
- [ ] View all return policies
- [ ] Create new return policy
- [ ] Edit existing return policy
- [ ] Delete return policy
- [ ] Scope validation works

### Phase 2: Customer UIs

#### Return Requests
- [ ] Navigate to `/returns`
- [ ] View orders eligible for return
- [ ] Create return request for full order
- [ ] Create return request for specific items
- [ ] View return request status
- [ ] View return history

---

## API Testing with curl

### Test Promotion Creation
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hos.com","password":"Test123!"}' | \
  jq -r '.data.token')

# Create Promotion
curl -X POST http://localhost:3001/api/promotions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Promotion",
    "type": "PERCENTAGE_DISCOUNT",
    "status": "ACTIVE",
    "startDate": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "conditions": {"cartValue": {"min": 50}},
    "actions": {"type": "PERCENTAGE_DISCOUNT", "percentage": 20}
  }'
```

### Test Shipping Calculation
```bash
curl -X POST http://localhost:3001/api/shipping/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "weight": 2.5,
    "cartValue": 75,
    "destination": {
      "country": "GB",
      "city": "London",
      "postalCode": "SW1A 1AA"
    }
  }'
```

---

## Troubleshooting

### Tests Fail with "Login failed"
- Ensure test users exist: `cd services/api && pnpm db:create-team-users`
- Check API server is running: `curl http://localhost:3001/api/health`

### Tests Fail with "Endpoint not found"
- Check API routes are registered in `app.module.ts`
- Verify controller paths match test scripts
- Check API versioning: `/api/v1/` vs `/api/`

### Playwright Tests Fail
- Ensure frontend server is running: `cd apps/web && pnpm dev`
- Check browser is installed: `pnpm exec playwright install`
- Increase timeouts in `playwright.config.ts` if needed

### Database Errors
- Run migrations: `cd services/api && pnpm db:push`
- Check database connection in `.env`
- Verify Prisma client is generated: `pnpm db:generate`

---

## Expected Results

### Successful Test Run
```
🧪 Phase 1 & Phase 2 Comprehensive Testing
============================================

📦 PHASE 1 TESTS
==================

✅ Promotion Engine: PASSED
✅ Shipping Rules: PASSED

📦 PHASE 2 TESTS
==================

✅ Customer Groups: PASSED
✅ Return Policies: PASSED
✅ Return Requests: PASSED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Passed: 5
❌ Failed: 0
Total: 5

🎉 All tests passed!
```

---

## Next Steps

After running tests:
1. Review any failed tests
2. Fix identified issues
3. Re-run tests to verify fixes
4. Update test scripts if API changes
5. Add new tests for edge cases

---

**Status**: ✅ **READY FOR EXECUTION**
