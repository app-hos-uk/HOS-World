# Testing Promotions Endpoints

## Quick Test Guide

### 1. Get All Promotions

**Endpoint**: `GET /api/promotions`

**Using curl:**
```bash
curl -X GET http://localhost:3001/api/promotions
```

**Using Swagger UI:**
1. Visit http://localhost:3001/api/docs
2. Find `PromotionsController`
3. Click on `GET /api/promotions`
4. Click "Try it out"
5. Click "Execute"

**Expected Response:**
```json
{
  "data": [],
  "message": "Active promotions retrieved successfully"
}
```
(Empty array if no promotions exist yet)

---

### 2. Validate Coupon Code

**Endpoint**: `POST /api/promotions/coupons/validate`

**Request Body:**
```json
{
  "couponCode": "SUMMER20"
}
```

**Using curl:**
```bash
curl -X POST http://localhost:3001/api/promotions/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "SUMMER20"}'
```

**Using Swagger UI:**
1. Visit http://localhost:3001/api/docs
2. Find `PromotionsController`
3. Click on `POST /api/promotions/coupons/validate`
4. Click "Try it out"
5. Enter the request body:
   ```json
   {
     "couponCode": "SUMMER20"
   }
   ```
6. Click "Execute"

**Expected Response (if coupon exists):**
```json
{
  "data": {
    "valid": true,
    "coupon": {
      "id": "...",
      "code": "SUMMER20",
      "promotion": {...}
    }
  },
  "message": "Coupon is valid"
}
```

**Expected Response (if coupon doesn't exist):**
```json
{
  "data": {
    "valid": false,
    "error": "Coupon not found or expired"
  },
  "message": "Coupon validation failed"
}
```

---

## Creating Test Data

To test these endpoints properly, you'll need to create a promotion and coupon first.

### Step 1: Create a Promotion

**Endpoint**: `POST /api/promotions`

**Request Body:**
```json
{
  "name": "Summer Sale 2024",
  "description": "20% off on all products",
  "type": "PERCENTAGE",
  "value": 20,
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "status": "ACTIVE",
  "conditions": {
    "minCartValue": 50
  }
}
```

**Using curl (requires authentication):**
```bash
# First, get a token by logging in
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Test123!"}' \
  | jq -r '.data.accessToken')

# Then create promotion
curl -X POST http://localhost:3001/api/promotions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Summer Sale 2024",
    "description": "20% off on all products",
    "type": "PERCENTAGE",
    "value": 20,
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "status": "ACTIVE",
    "conditions": {
      "minCartValue": 50
    }
  }'
```

### Step 2: Create a Coupon

**Endpoint**: `POST /api/promotions/coupons`

**Request Body:**
```json
{
  "code": "SUMMER20",
  "promotionId": "<PROMOTION_ID_FROM_STEP_1>",
  "maxUses": 100,
  "status": "ACTIVE"
}
```

**Using curl:**
```bash
curl -X POST http://localhost:3001/api/promotions/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "code": "SUMMER20",
    "promotionId": "<PROMOTION_ID>",
    "maxUses": 100,
    "status": "ACTIVE"
  }'
```

---

## Testing Without Authentication

Some endpoints are public (no authentication required):
- `GET /api/promotions` - List active promotions (public)
- `POST /api/promotions/coupons/validate` - Validate coupon (public)

For creating promotions/coupons, you need:
- Role: `ADMIN` or `MARKETING`
- Authentication token

---

## Quick Test Script

Save this as `test-promotions.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3001/api"

echo "=== Testing Promotions Endpoints ==="
echo ""

echo "1. Getting all promotions..."
curl -s -X GET "$API_URL/promotions" | jq '.'
echo ""

echo "2. Validating coupon code 'SUMMER20'..."
curl -s -X POST "$API_URL/promotions/coupons/validate" \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "SUMMER20"}' | jq '.'
echo ""

echo "3. Validating invalid coupon code..."
curl -s -X POST "$API_URL/promotions/coupons/validate" \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "INVALID"}' | jq '.'
echo ""

echo "=== Test Complete ==="
```

Run with:
```bash
chmod +x test-promotions.sh
./test-promotions.sh
```

---

## Using Swagger UI (Recommended)

The easiest way to test is via Swagger UI:

1. **Visit**: http://localhost:3001/api/docs
2. **Find**: `PromotionsController` section
3. **Test endpoints**:
   - `GET /api/promotions` - No auth needed
   - `POST /api/promotions/coupons/validate` - No auth needed
   - `POST /api/promotions` - Requires auth (click "Authorize" button first)
   - `POST /api/promotions/coupons` - Requires auth

4. **To authenticate in Swagger**:
   - Click the "Authorize" button at the top
   - Enter: `Bearer YOUR_TOKEN_HERE`
   - Or login first via `/api/auth/login` to get a token

---

## Expected Results

### GET /api/promotions
- Returns array of active promotions
- Empty array `[]` if no promotions exist
- No authentication required

### POST /api/promotions/coupons/validate
- Returns validation result
- `{"valid": false}` if coupon doesn't exist
- `{"valid": true, "coupon": {...}}` if valid
- No authentication required
