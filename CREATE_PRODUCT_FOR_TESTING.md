# Create Product for Testing

## Problem
You need a product to test stock transfers, but no products exist yet.

## Solution: Create a Test Product

### Option 1: Create via Admin UI (Easiest)

1. Open browser: `http://localhost:3000`
2. Login with: `app@houseofspells.co.uk` / `Admin123`
3. Go to `/admin/products` or `/seller/products`
4. Click "+ Add Product" or "Create Product"
5. Fill in product details:
   - Name: "Test Wand"
   - SKU: "WAND-001"
   - Price: 29.99
   - Description: "A test wand for inventory testing"
   - Status: Active
6. Save the product
7. Copy the product ID

---

### Option 2: Create via API

**Step 1: Find your seller ID**

You need to be a seller or have a seller account to create products. First, check if you have a seller profile:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

# Get seller profile
curl -s -X GET http://localhost:3001/api/v1/sellers/me \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

If you don't have a seller profile, create one first, or use an existing seller ID from your database.

**Step 2: Create Product via API**

```bash
# Replace SELLER_ID with actual seller ID
# Note: As ADMIN, you might need to use a different endpoint
# Check if there's an admin product creation endpoint

curl -s -X POST http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Wand",
    "sku": "WAND-001",
    "description": "A test wand for inventory management testing",
    "price": 29.99,
    "currency": "GBP",
    "stock": 100,
    "status": "ACTIVE",
    "fandom": "Harry Potter",
    "category": "Wands"
  }' | jq '.'
```

---

### Option 3: Use Admin Products Endpoint

If you're an admin, try the admin products endpoint:

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Wand",
    "sku": "WAND-001",
    "description": "Test product for inventory",
    "price": 29.99,
    "currency": "GBP",
    "stock": 100,
    "status": "ACTIVE"
  }' | jq '.'
```

---

## Quick Solution: Check Database for Existing Products

If you have existing products in your database:

```bash
# Use psql to check products
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway" -c "SELECT id, name, sku FROM products LIMIT 5;"
```

---

## Alternative: Skip Product Creation for Now

If creating products is complex, you can test the other Phase 3 features that don't require products:

### Test Tax Zones (No Product Needed)

```bash
# Get tax zones
curl -s -X GET http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Create tax zone
curl -s -X POST http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "UK Standard Rate Zone",
    "country": "GB",
    "isActive": true
  }' | jq '.'

# Get tax classes
curl -s -X GET http://localhost:3001/api/v1/tax/classes \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Create tax class
curl -s -X POST http://localhost:3001/api/v1/tax/classes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard Rate",
    "description": "Standard VAT rate"
  }' | jq '.'
```

---

## Recommended: Use Admin UI

The easiest way is to use the Admin UI to create a product:

1. Go to `http://localhost:3000/admin/products`
2. Create a product with a simple form
3. Copy the product ID from the URL or response
4. Use that ID for inventory testing

---

## After Creating Product

Once you have a product ID, continue with inventory testing:

```bash
# Create inventory location
curl -s -X POST http://localhost:3001/api/v1/inventory/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouseId": "c0d33c04-80b1-405d-97d2-e1a2b167a1a5",
    "productId": "YOUR_PRODUCT_ID",
    "quantity": 100,
    "lowStockThreshold": 10
  }' | jq '.'
```
