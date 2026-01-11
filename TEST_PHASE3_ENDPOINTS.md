# Test Phase 3 Endpoints - Ready to Go! ✅

## ✅ Login Successful!

You now have:
- **Access Token**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **User Role**: ADMIN
- **User ID**: `be47307a-2afc-4d83-b44a-ba473f09458b`

---

## Save Token for Easy Use

```bash
# Save your token to a variable
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

# Now use $TOKEN in all requests
```

---

## Test Phase 3 Endpoints

### 1. Test Warehouses Endpoint

```bash
# Get all warehouses
curl -X GET http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: List of warehouses (might be empty if none created yet)

---

### 2. Create a Warehouse

```bash
curl -X POST http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "London Warehouse",
    "code": "WH-LON-01",
    "address": "123 Warehouse St",
    "city": "London",
    "country": "GB",
    "postalCode": "SW1A 1AA"
  }'
```

Save the returned `id` - you'll need it for transfers!

---

### 3. Get Stock Transfers

```bash
curl -X GET http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN"
```

---

### 4. Create Stock Transfer

**First, get warehouse IDs and a product ID, then:**

```bash
curl -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "WAREHOUSE_ID_1",
    "toWarehouseId": "WAREHOUSE_ID_2",
    "productId": "PRODUCT_ID",
    "quantity": 10,
    "notes": "Test stock transfer"
  }'
```

---

### 5. Test Tax Zones

```bash
# Get all tax zones
curl -X GET http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN"

# Get tax classes
curl -X GET http://localhost:3001/api/v1/tax/classes \
  -H "Authorization: Bearer $TOKEN"
```

---

### 6. Create Tax Zone

```bash
curl -X POST http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "UK Standard Rate",
    "country": "GB",
    "isActive": true
  }'
```

---

### 7. Get Stock Movements

```bash
curl -X GET http://localhost:3001/api/v1/inventory/movements \
  -H "Authorization: Bearer $TOKEN"
```

---

## Complete Test Sequence

Here's a complete test flow:

```bash
# 1. Save token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

# 2. Get warehouses
echo "📦 Getting warehouses..."
curl -s -X GET http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. Get products (to find a product ID)
echo "🛍️ Getting products..."
curl -s -X GET "http://localhost:3001/api/v1/products?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.products[0] | {id, name, sku}'

# 4. Get tax zones
echo "💰 Getting tax zones..."
curl -s -X GET http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 5. Get stock transfers
echo "🔄 Getting stock transfers..."
curl -s -X GET http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Using jq for Better Output

If you have `jq` installed (JSON formatter), you'll get prettier output:

```bash
# Install jq (if not installed)
# macOS:
brew install jq

# Then use it:
curl -s -X GET http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Test Admin UI

Now that you're logged in, test the admin UI pages:

1. **Open browser**: `http://localhost:3000`
2. **Login** with the same credentials:
   - Email: `app@houseofspells.co.uk`
   - Password: `Admin123`
3. **Navigate to**:
   - `/admin/warehouses` - Manage warehouses
   - `/admin/warehouses/transfers` - Stock transfers
   - `/admin/tax-zones` - Tax zones management
   - `/admin/inventory` - Inventory dashboard

---

## Next Steps

✅ **Completed:**
- Login successful
- Token obtained
- Ready to test endpoints

🎯 **Next:**
1. Test warehouses endpoint
2. Create warehouses via UI or API
3. Test stock transfers
4. Test tax zones
5. Verify everything works end-to-end

---

**Your token expires in**: ~15 minutes (check the `exp` field in JWT)
**To get a new token**: Just login again with the same credentials
