# Continue Phase 3 Testing - Next Steps

## ✅ What's Done

1. ✅ Login successful
2. ✅ Token obtained
3. ✅ Warehouse created: London Warehouse (ID: `c0d33c04-80b1-405d-97d2-e1a2b167a1a5`)
4. ✅ jq installed for better JSON output

---

## Next Steps to Test Stock Transfers

### Step 1: Create Second Warehouse (Required for Transfers)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

# Create Manchester Warehouse
curl -s -X POST http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manchester Warehouse",
    "code": "WH-MAN-01",
    "address": "456 Storage Road",
    "city": "Manchester",
    "country": "GB",
    "postalCode": "M1 1AA"
  }' | jq '.'
```

**Save the returned warehouse ID** for the transfer!

---

### Step 2: Get a Product ID

You need a product that exists in your database:

```bash
# Get products
curl -s -X GET "http://localhost:3001/api/v1/products?page=1&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.products[0] | {id, name, sku}'
```

Or search for products:
```bash
curl -s -X GET "http://localhost:3001/api/v1/search?q=wand&limit=1" | jq '.data.products[0] | {id, name}'
```

**Save the product ID** - you'll need it for stock transfers.

---

### Step 3: Create Inventory Location

Before you can transfer stock, you need inventory in the source warehouse:

```bash
# Replace WAREHOUSE_ID and PRODUCT_ID with real IDs
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

---

### Step 4: Create Stock Transfer

Now you can create a stock transfer between warehouses:

```bash
# Replace with real IDs
curl -s -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "c0d33c04-80b1-405d-97d2-e1a2b167a1a5",
    "toWarehouseId": "SECOND_WAREHOUSE_ID",
    "productId": "YOUR_PRODUCT_ID",
    "quantity": 10,
    "notes": "Test stock transfer from London to Manchester"
  }' | jq '.'
```

---

### Step 5: View Stock Transfers

```bash
# Get all transfers
curl -s -X GET http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get only pending transfers
curl -s -X GET "http://localhost:3001/api/v1/inventory/transfers?status=PENDING" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

### Step 6: Complete Stock Transfer

```bash
# Replace TRANSFER_ID with the ID from step 4
curl -s -X POST http://localhost:3001/api/v1/inventory/transfers/TRANSFER_ID/complete \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Test Tax Zones

### Get Tax Zones
```bash
curl -s -X GET http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Create Tax Zone
```bash
curl -s -X POST http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "UK Standard Rate Zone",
    "country": "GB",
    "isActive": true
  }' | jq '.'
```

### Get Tax Classes
```bash
curl -s -X GET http://localhost:3001/api/v1/tax/classes \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Create Tax Class
```bash
curl -s -X POST http://localhost:3001/api/v1/tax/classes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard Rate",
    "description": "Standard VAT rate for most products"
  }' | jq '.'
```

### Create Tax Rate
```bash
# Replace ZONE_ID and CLASS_ID with real IDs
curl -s -X POST http://localhost:3001/api/v1/tax/rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taxZoneId": "ZONE_ID",
    "taxClassId": "CLASS_ID",
    "rate": 0.20,
    "isInclusive": false,
    "isActive": true
  }' | jq '.'
```

---

## Test Stock Movements (Audit Trail)

```bash
# Get all stock movements
curl -s -X GET http://localhost:3001/api/v1/inventory/movements \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Filter by product
curl -s -X GET "http://localhost:3001/api/v1/inventory/movements?productId=PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Filter by movement type
curl -s -X GET "http://localhost:3001/api/v1/inventory/movements?movementType=OUT" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Quick Reference: Your Current Data

**Warehouse Created:**
- ID: `c0d33c04-80b1-405d-97d2-e1a2b167a1a5`
- Name: London Warehouse
- Code: WH-LON-01

**Token:**
- `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80`

---

## Test Admin UI

1. Open browser: `http://localhost:3000`
2. Login with: `app@houseofspells.co.uk` / `Admin123`
3. Go to `/admin/warehouses` - you should see your London Warehouse
4. Click "+ Add Warehouse" to create more via UI
5. Go to `/admin/warehouses/transfers` to manage transfers
6. Go to `/admin/tax-zones` to manage tax zones
7. Go to `/admin/inventory` to see the dashboard
