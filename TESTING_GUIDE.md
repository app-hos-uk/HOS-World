# Comprehensive Testing Guide

## Overview
This guide covers testing for the recent fixes:
1. Product visibility issue (PUBLISHED → ACTIVE status mapping)
2. Category/fandom optional fields in product submission

## Prerequisites

1. **Environment Variables** (for test scripts):
   ```bash
   export API_URL="https://hos-marketplaceapi-production.up.railway.app/api"
   export ADMIN_EMAIL="admin@houseofspells.co.uk"
   export ADMIN_PASSWORD="your-admin-password"
   ```

2. **Admin Access**: You need admin credentials to create/update products

## Test Scripts

### 1. Bash Script (test-product-visibility.sh)
```bash
# Make executable
chmod +x test-product-visibility.sh

# Run with environment variables
API_URL="https://hos-marketplaceapi-production.up.railway.app/api" \
ADMIN_EMAIL="admin@houseofspells.co.uk" \
ADMIN_PASSWORD="your-password" \
./test-product-visibility.sh
```

### 2. Node.js Script (test-product-visibility.js)
```bash
# Run with environment variables
API_URL="https://hos-marketplaceapi-production.up.railway.app/api" \
ADMIN_EMAIL="admin@houseofspells.co.uk" \
ADMIN_PASSWORD="your-password" \
node test-product-visibility.js
```

## Manual Testing Steps

### Test 1: Product Creation with PUBLISHED Status

**Objective**: Verify that products created with 'PUBLISHED' status are correctly mapped to 'ACTIVE'

**Steps**:
1. Login as admin
2. Create a product via API:
   ```bash
   POST /api/admin/products
   {
     "name": "Test Product",
     "description": "Test description",
     "price": 29.99,
     "currency": "GBP",
     "stock": 10,
     "status": "PUBLISHED",
     "sku": "TEST-001"
   }
   ```
3. Verify response: Product should have `status: "ACTIVE"` (not "PUBLISHED")
4. Check customer-facing API:
   ```bash
   GET /api/products
   ```
5. Verify: Product should appear in the list

**Expected Result**: ✅ Product created with ACTIVE status and visible to customers

---

### Test 2: Product Status Update

**Objective**: Verify that updating product status to 'PUBLISHED' maps to 'ACTIVE'

**Steps**:
1. Get an existing product ID (or create one with DRAFT status)
2. Update product status:
   ```bash
   PUT /api/admin/products/{id}
   {
     "status": "PUBLISHED"
   }
   ```
3. Verify response: Product should have `status: "ACTIVE"`
4. Check customer visibility: Product should appear in `/api/products`

**Expected Result**: ✅ Status update correctly maps PUBLISHED → ACTIVE

---

### Test 3: Product Visibility to Customers

**Objective**: Verify only ACTIVE products are visible to customers

**Steps**:
1. Create products with different statuses:
   - Product A: `status: "DRAFT"`
   - Product B: `status: "ACTIVE"`
   - Product C: `status: "INACTIVE"`
2. Query customer-facing API:
   ```bash
   GET /api/products
   ```
3. Verify: Only Product B should appear in results

**Expected Result**: ✅ Only ACTIVE products visible to customers

---

### Test 4: Fandoms API (Category/Fandom Issue)

**Objective**: Verify fandoms API works and handles errors gracefully

**Steps**:
1. Test fandoms endpoint:
   ```bash
   GET /api/fandoms
   ```
2. Verify response: Should return array of fandoms or empty array
3. Check frontend: Visit `/seller/submit-product` page
4. Verify: Fandom dropdown should load (even if empty)
5. Verify: Error message shown if API fails, but form still allows submission

**Expected Result**: ✅ Fandoms API works, frontend handles errors gracefully

---

### Test 5: Product Submission with Optional Fandom/Category

**Objective**: Verify sellers can submit products without fandom/category

**Steps**:
1. Login as seller
2. Navigate to `/seller/submit-product`
3. Fill in required fields (name, description, price, stock, images)
4. Leave fandom and category empty
5. Submit product
6. Verify: Submission should succeed

**Expected Result**: ✅ Product submission works without fandom/category

---

### Test 6: No Products Available Scenario

**Objective**: Verify improved "no products" messaging

**Steps**:
1. Ensure no ACTIVE products exist (or filter to show none)
2. Visit `/products` page as customer
3. Verify: Should show clear "No products available" message
4. Apply filters (search, fandom, category)
5. Verify: Should show context-aware message with "Clear Filters" button

**Expected Result**: ✅ Better UX for empty product listings

---

## API Endpoints Reference

### Admin Endpoints (Require Admin Token)
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `GET /api/admin/products` - List all products (any status)

### Public Endpoints
- `GET /api/products` - List active products (customer-facing)
- `GET /api/fandoms` - List fandoms
- `GET /api/products/:id` - Get product details

### Seller Endpoints (Require Seller Token)
- `POST /api/submissions` - Submit product for review

## Verification Checklist

- [ ] Product creation with PUBLISHED status maps to ACTIVE
- [ ] Product status update from PUBLISHED maps to ACTIVE
- [ ] Only ACTIVE products visible to customers
- [ ] Fandoms API works correctly
- [ ] Product submission works without fandom/category
- [ ] Frontend shows clear error messages for fandoms API failures
- [ ] "No products" page shows improved messaging
- [ ] Filter clearing works on products page

## Troubleshooting

### Issue: Products not visible to customers
- Check product status: Should be "ACTIVE"
- Verify API filter: `/api/products` only returns ACTIVE products
- Check admin panel: Product should show as ACTIVE

### Issue: Status update not working
- Verify admin token is valid
- Check API response for errors
- Verify product ID exists

### Issue: Fandoms API failing
- Check API logs for errors
- Verify database has fandoms with `isActive: true`
- Check frontend error handling

## Post-Deployment Verification

After deployment, run:
```bash
# Quick test
node test-product-visibility.js

# Or detailed test
./test-product-visibility.sh
```

Review test results and verify all tests pass.

