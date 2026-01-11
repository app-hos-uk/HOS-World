# Test Stock Transfer Endpoint

## Prerequisites

Before testing, you need:
1. ✅ Two warehouses created in the database
2. ✅ At least one product with inventory
3. ✅ Admin JWT token for authentication
4. ✅ API server running on `http://localhost:3001`

---

## Step 1: Start the API Server

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm start:dev
```

The API should start on `http://localhost:3001`

---

## Step 2: Get Authentication Token

### Option A: Login via API

```bash
# Login as admin user
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-admin-password"
  }'

# Copy the "accessToken" from the response
```

### Option B: Use Existing Token

If you already have a valid JWT token, use it.

---

## Step 3: Get Warehouse IDs

```bash
# Replace YOUR_TOKEN with your actual JWT token
curl -X GET http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response will contain:
# {
#   "data": [
#     {
#       "id": "uuid-1",
#       "name": "London Warehouse",
#       "code": "WH-LON-01",
#       ...
#     },
#     {
#       "id": "uuid-2",
#       "name": "Manchester Warehouse",
#       "code": "WH-MAN-01",
#       ...
#     }
#   ]
# }
```

**Copy the `id` values** for two different warehouses.

---

## Step 4: Get Product ID

```bash
# Get products with inventory
curl -X GET http://localhost:3001/api/v1/products?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or search for a specific product
curl -X GET "http://localhost:3001/api/v1/products?q=wand" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response will contain products with their IDs
# Copy a product ID that has stock
```

---

## Step 5: Create Stock Transfer

Now use the real IDs from steps 3 and 4:

```bash
curl -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "REAL_WAREHOUSE_ID_1",
    "toWarehouseId": "REAL_WAREHOUSE_ID_2",
    "productId": "REAL_PRODUCT_ID",
    "quantity": 10,
    "notes": "Test stock transfer"
  }'
```

**Expected Response (201 Created):**
```json
{
  "data": {
    "id": "transfer-uuid",
    "fromWarehouseId": "...",
    "toWarehouseId": "...",
    "productId": "...",
    "quantity": 10,
    "status": "PENDING",
    "requestedBy": "user-id",
    "notes": "Test stock transfer",
    "createdAt": "2025-01-XX...",
    "updatedAt": "2025-01-XX..."
  },
  "message": "Stock transfer created successfully"
}
```

---

## Step 6: Verify Transfer Created

```bash
# Get all transfers
curl -X GET http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get pending transfers only
curl -X GET "http://localhost:3001/api/v1/inventory/transfers?status=PENDING" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Step 7: Complete the Transfer

```bash
# Replace TRANSFER_ID with the ID from step 5
curl -X POST http://localhost:3001/api/v1/inventory/transfers/TRANSFER_ID/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response (200 OK):**
```json
{
  "data": {
    "id": "transfer-uuid",
    "status": "COMPLETED",
    "completedBy": "user-id",
    "completedAt": "2025-01-XX...",
    ...
  },
  "message": "Stock transfer completed successfully"
}
```

After completion:
- ✅ Stock decreased in source warehouse
- ✅ Stock increased in destination warehouse
- ✅ Stock movements recorded for audit trail

---

## Complete Test Script

Save this as `test-stock-transfer.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3001/api/v1"
EMAIL="admin@example.com"
PASSWORD="your-admin-password"

# Step 1: Login and get token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo "✅ Logged in successfully"
echo "Token: ${TOKEN:0:20}..."

# Step 2: Get warehouses
echo ""
echo "📦 Getting warehouses..."
WAREHOUSES=$(curl -s -X GET "$API_URL/inventory/warehouses" \
  -H "Authorization: Bearer $TOKEN")

echo $WAREHOUSES | jq '.data[0:2] | .[] | {id, name, code}'

# Extract first two warehouse IDs (you'll need jq installed)
# WAREHOUSE_1_ID=$(echo $WAREHOUSES | jq -r '.data[0].id')
# WAREHOUSE_2_ID=$(echo $WAREHOUSES | jq -r '.data[1].id')

# Step 3: Get products
echo ""
echo "🛍️ Getting products..."
PRODUCTS=$(curl -s -X GET "$API_URL/products?page=1&limit=1" \
  -H "Authorization: Bearer $TOKEN")

echo $PRODUCTS | jq '.data.products[0] | {id, name, sku}'

# PRODUCT_ID=$(echo $PRODUCTS | jq -r '.data.products[0].id')

# Step 4: Create transfer (uncomment and update IDs)
# echo ""
# echo "🔄 Creating stock transfer..."
# TRANSFER_RESPONSE=$(curl -s -X POST "$API_URL/inventory/transfers" \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d "{
#     \"fromWarehouseId\": \"$WAREHOUSE_1_ID\",
#     \"toWarehouseId\": \"$WAREHOUSE_2_ID\",
#     \"productId\": \"$PRODUCT_ID\",
#     \"quantity\": 10,
#     \"notes\": \"Automated test transfer\"
#   }")
# 
# echo $TRANSFER_RESPONSE | jq '.'

echo ""
echo "✅ Test script completed!"
echo "Update the script with real IDs and uncomment Step 4 to create a transfer"
```

Make it executable and run:
```bash
chmod +x test-stock-transfer.sh
./test-stock-transfer.sh
```

---

## Quick Test with Real Data

If you already have warehouses and products in your database:

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# 2. Get warehouse IDs (replace with your actual warehouse names/codes)
# You'll need to manually copy IDs from the response

# 3. Create transfer (replace IDs with real ones)
curl -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "YOUR_FROM_WAREHOUSE_ID",
    "toWarehouseId": "YOUR_TO_WAREHOUSE_ID",
    "productId": "YOUR_PRODUCT_ID",
    "quantity": 10,
    "notes": "Test transfer"
  }'
```

---

## Troubleshooting

### Error: "Warehouse not found"
- Make sure warehouse IDs exist
- Verify warehouse is active (`isActive: true`)

### Error: "Product not found"
- Make sure product ID exists
- Product must have inventory in source warehouse

### Error: "Insufficient stock"
- Check inventory levels in source warehouse
- Verify product has enough available stock (quantity - reserved)

### Error: 401 Unauthorized
- Check your JWT token is valid
- Make sure token hasn't expired
- Login again to get a fresh token

### Error: "Source and destination warehouses must be different"
- Use two different warehouse IDs
- Can't transfer from a warehouse to itself

---

## Next Steps

After successfully creating a transfer:
1. ✅ View it in `/admin/warehouses/transfers` UI
2. ✅ Complete it from the UI or API
3. ✅ Verify stock movements were recorded
4. ✅ Check inventory levels updated correctly
