# Create Product as Admin - Quick Guide

## Use Admin Products Endpoint

Since you're an ADMIN, you can use the admin products endpoint:

### Create a Test Product

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

# Create a test product (platform-owned)
curl -s -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Wand",
    "description": "A test wand for inventory management testing",
    "price": 29.99,
    "currency": "GBP",
    "stock": 100,
    "sku": "WAND-001",
    "status": "ACTIVE",
    "fandom": "Harry Potter",
    "isPlatformOwned": true,
    "images": []
  }' | jq '.'
```

**This will:**
- ✅ Create a platform-owned product (no seller required)
- ✅ Set stock to 100
- ✅ Set status to ACTIVE
- ✅ Return the product with its ID

**Save the `id` from the response** - you'll need it for inventory testing!

---

## After Creating Product

Once you have the product ID, continue with inventory testing:

### Step 1: Create Inventory Location in Warehouse

```bash
# Replace PRODUCT_ID with the ID from product creation
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

### Step 2: Create Stock Transfer

```bash
curl -s -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "c0d33c04-80b1-405d-97d2-e1a2b167a1a5",
    "toWarehouseId": "453cf2f3-9428-420f-ad51-139a081732da",
    "productId": "YOUR_PRODUCT_ID",
    "quantity": 10,
    "notes": "Test stock transfer from London to Manchester"
  }' | jq '.'
```

---

## Quick Test All-in-One

Run this sequence:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

# 1. Create product
echo "📦 Creating product..."
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Wand",
    "description": "A test wand for inventory testing",
    "price": 29.99,
    "currency": "GBP",
    "stock": 100,
    "sku": "WAND-001",
    "status": "ACTIVE",
    "fandom": "Harry Potter",
    "isPlatformOwned": true,
    "images": []
  }')

echo $PRODUCT_RESPONSE | jq '.'
PRODUCT_ID=$(echo $PRODUCT_RESPONSE | jq -r '.data.id')
echo "✅ Product ID: $PRODUCT_ID"

# 2. Create inventory location
echo ""
echo "📦 Creating inventory location..."
curl -s -X POST http://localhost:3001/api/v1/inventory/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"warehouseId\": \"c0d33c04-80b1-405d-97d2-e1a2b167a1a5\",
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 100,
    \"lowStockThreshold\": 10
  }" | jq '.'

# 3. Create stock transfer
echo ""
echo "🔄 Creating stock transfer..."
curl -s -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fromWarehouseId\": \"c0d33c04-80b1-405d-97d2-e1a2b167a1a5\",
    \"toWarehouseId\": \"453cf2f3-9428-420f-ad51-139a081732da\",
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 10,
    \"notes\": \"Test stock transfer from London to Manchester\"
  }" | jq '.'
```

---

## Alternative: Use Admin UI

If you prefer using the UI:

1. Open: `http://localhost:3000/admin/products`
2. Click "+ Add Product" or "Create Product"
3. Fill in product details
4. Save and copy the product ID
5. Use that ID for inventory testing
