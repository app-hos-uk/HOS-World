# Phase 3 Features Testing Guide

## Testing Stock Transfer Functionality

### 1. Test Create Stock Transfer

```bash
# POST /api/v1/inventory/transfers
# Headers: Authorization: Bearer <admin_token>

curl -X POST "http://localhost:3001/api/v1/inventory/transfers" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "warehouse-id-1",
    "toWarehouseId": "warehouse-id-2",
    "productId": "product-id",
    "quantity": 10,
    "notes": "Test transfer"
  }'
```

**Expected Response:**
- Status: 201 Created
- Body: Transfer object with status "PENDING"

### 2. Test Get Stock Transfers

```bash
# GET /api/v1/inventory/transfers
curl -X GET "http://localhost:3001/api/v1/inventory/transfers?status=PENDING&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
- Status: 200 OK
- Body: Paginated list of transfers

### 3. Test Complete Stock Transfer

```bash
# POST /api/v1/inventory/transfers/{transferId}/complete
curl -X POST "http://localhost:3001/api/v1/inventory/transfers/TRANSFER_ID/complete" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
- Status: 200 OK
- Body: Transfer object with status "COMPLETED"
- **Verify**: Source warehouse stock decreased, destination warehouse stock increased

### 4. Test Stock Movement History

```bash
# GET /api/v1/inventory/movements
curl -X GET "http://localhost:3001/api/v1/inventory/movements?productId=PRODUCT_ID&movementType=OUT&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
- Status: 200 OK
- Body: Paginated list of stock movements

### 5. Test Location-Based Order Allocation

```bash
# POST /api/v1/inventory/allocate-with-location
curl -X POST "http://localhost:3001/api/v1/inventory/allocate-with-location" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderItems": [
      {"productId": "product-1", "quantity": 2},
      {"productId": "product-2", "quantity": 1}
    ],
    "shippingAddress": {
      "country": "GB",
      "state": "England",
      "city": "London",
      "postalCode": "SW1A 1AA"
    }
  }'
```

**Expected Response:**
- Status: 200 OK
- Body: Array of allocations with warehouse priorities (nearest first)

---

## Testing Enhanced Faceted Search

### 1. Test Basic Search with Aggregations

```bash
# GET /api/v1/search?q=wand&page=1&limit=20
curl -X GET "http://localhost:3001/api/v1/search?q=wand&page=1&limit=20"
```

**Expected Response:**
- Status: 200 OK
- Body includes `aggregations` with:
  - `categories` - category terms
  - `fandoms` - fandom terms
  - `price_ranges` - price range buckets
  - `attributes` - nested attribute aggregations (if products have attributes)

### 2. Test Category ID Filter

```bash
# GET /api/v1/search?categoryId=category-uuid
curl -X GET "http://localhost:3001/api/v1/search?categoryId=CATEGORY_ID"
```

**Expected Response:**
- Status: 200 OK
- Only products in the specified category

### 3. Test Attribute Filter (SELECT type)

```bash
# GET /api/v1/search?attributes=[{"attributeId":"attr-id","values":["value-slug-1","value-slug-2"]}]
curl -X GET "http://localhost:3001/api/v1/search?attributes=%5B%7B%22attributeId%22%3A%22ATTR_ID%22%2C%22values%22%3A%5B%22value1%22%2C%22value2%22%5D%7D%5D"
```

**Note**: URL encode the JSON array. The example above is URL-encoded.

**Expected Response:**
- Status: 200 OK
- Products matching the attribute values

### 4. Test Attribute Filter (NUMBER type)

```bash
# GET /api/v1/search?attributes=[{"attributeId":"size-id","minValue":10,"maxValue":50}]
curl -X GET "http://localhost:3001/api/v1/search?attributes=%5B%7B%22attributeId%22%3A%22SIZE_ATTR_ID%22%2C%22minValue%22%3A10%2C%22maxValue%22%3A50%7D%5D"
```

**Expected Response:**
- Status: 200 OK
- Products with number attribute values in range

### 5. Test Multiple Attribute Filters (AND logic)

```bash
# Filter by multiple attributes - all must match
curl -X GET "http://localhost:3001/api/v1/search?attributes=%5B%7B%22attributeId%22%3A%22ATTR1%22%2C%22values%22%3A%5B%22val1%22%5D%7D%2C%7B%22attributeId%22%3A%22ATTR2%22%2C%22minValue%22%3A10%7D%5D"
```

**Expected Response:**
- Status: 200 OK
- Products matching ALL specified attribute filters

### 6. Test Attribute Aggregations in Response

After a search, check the `aggregations.attributes` structure:

```json
{
  "aggregations": {
    "attributes": {
      "by_attribute": {
        "buckets": [
          {
            "key": "attribute-id",
            "attribute_name": {
              "buckets": [{"key": "Color"}]
            },
            "values": {
              "buckets": [
                {"key": "red", "doc_count": 5},
                {"key": "blue", "doc_count": 3}
              ]
            }
          }
        ]
      }
    }
  }
}
```

---

## Testing Tax Integration

### 1. Test Cart Tax Calculation

```bash
# Add item to cart, then get cart
curl -X GET "http://localhost:3001/api/v1/cart" \
  -H "Authorization: Bearer USER_TOKEN"
```

**Expected Response:**
- Cart includes `tax` field calculated based on:
  - User's default address OR user's country
  - Product's taxClassId
  - Tax zones service

### 2. Test Order Tax Calculation

```bash
# Create order (after adding items to cart)
curl -X POST "http://localhost:3001/api/v1/orders" \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddressId": "address-id",
    "billingAddressId": "address-id",
    "paymentMethod": "stripe"
  }'
```

**Expected Response:**
- Order includes `tax` field calculated using shipping address
- Tax is stored at order level

---

## Verification Checklist

- [ ] Stock transfer creates successfully
- [ ] Stock transfer completion updates warehouse inventory correctly
- [ ] Stock movements are recorded for all transfers
- [ ] Location-based allocation prioritizes nearest warehouses
- [ ] Search returns products with aggregations
- [ ] Attribute filters work for SELECT type (values array)
- [ ] Attribute filters work for NUMBER type (min/max range)
- [ ] Attribute aggregations appear in search results
- [ ] Cart tax calculation uses tax zones
- [ ] Order tax calculation uses shipping address
- [ ] Tax falls back to product.taxRate if zones unavailable

---

## Common Issues & Solutions

### Issue: Elasticsearch not configured
**Solution**: Search features will work with Prisma fallback, but aggregations won't appear

### Issue: No attributes in search results
**Solution**: Ensure products are re-indexed after adding attributes: `POST /api/v1/search/sync` (if endpoint exists) or wait for auto-sync

### Issue: Stock transfer fails with "Insufficient stock"
**Solution**: Verify source warehouse has enough available stock (quantity - reserved)

### Issue: Tax calculation returns 0
**Solution**: Check that:
1. User has default address OR country set
2. Product has taxClassId assigned
3. Tax zones are configured in database
