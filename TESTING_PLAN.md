# End-to-End Testing Plan

## Overview
This document outlines comprehensive testing for all newly implemented features.

## Prerequisites
- Database migrations completed (`pnpm db:generate` and `pnpm db:push`)
- API server running (`pnpm dev` in `services/api`)
- Test user accounts created (use `/admin/create-team-users` endpoint)

---

## 1. Promotion & Discount Engine

### Test Cases

#### 1.1 Create Promotion
```bash
POST /api/promotions
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "Summer Sale",
  "type": "PERCENTAGE",
  "value": 20,
  "conditions": {
    "minCartValue": 50
  },
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```
**Expected**: 201 Created, promotion object returned

#### 1.2 Create Coupon
```bash
POST /api/promotions/coupons
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "code": "SUMMER20",
  "promotionId": "<PROMOTION_ID>",
  "maxUses": 100
}
```
**Expected**: 201 Created, coupon object returned

#### 1.3 Apply Coupon to Cart
```bash
POST /api/promotions/coupons/apply
Authorization: Bearer <USER_TOKEN>
Body: {
  "cartId": "<CART_ID>",
  "couponCode": "SUMMER20"
}
```
**Expected**: 200 OK, cart updated with discount

#### 1.4 Validate Promotion Application
```bash
GET /api/cart/<CART_ID>
Authorization: Bearer <USER_TOKEN>
```
**Expected**: Cart includes `discount` field with calculated discount

---

## 2. Shipping Rules Engine

### Test Cases

#### 2.1 Create Shipping Method
```bash
POST /api/shipping/methods
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "Standard Shipping",
  "type": "FLAT_RATE",
  "isActive": true
}
```
**Expected**: 201 Created, shipping method returned

#### 2.2 Create Shipping Rule
```bash
POST /api/shipping/rules
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "UK Standard",
  "shippingMethodId": "<METHOD_ID>",
  "country": "GB",
  "rates": [
    { "min": 0, "max": 100, "rate": 5.99 }
  ]
}
```
**Expected**: 201 Created, shipping rule returned

#### 2.3 Calculate Shipping
```bash
POST /api/shipping/options
Authorization: Bearer <USER_TOKEN>
Body: {
  "cartItems": [
    { "productId": "<PRODUCT_ID>", "quantity": 2, "price": 25.00 }
  ],
  "cartValue": 50.00,
  "destination": {
    "country": "GB",
    "postalCode": "SW1A 1AA"
  }
}
```
**Expected**: 200 OK, array of shipping options with rates

---

## 3. Multi-Source Inventory

### Test Cases

#### 3.1 Create Warehouse
```bash
POST /api/inventory/warehouses
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "London Warehouse",
  "code": "LON-001",
  "addressLine1": "123 Warehouse St",
  "city": "London",
  "state": "England",
  "postalCode": "SW1A 1AA",
  "country": "GB"
}
```
**Expected**: 201 Created, warehouse object returned

#### 3.2 Create Inventory Location
```bash
POST /api/inventory/locations
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "warehouseId": "<WAREHOUSE_ID>",
  "productId": "<PRODUCT_ID>",
  "quantity": 100,
  "lowStockThreshold": 10
}
```
**Expected**: 201 Created, inventory location returned

#### 3.3 Reserve Stock
```bash
POST /api/inventory/reservations
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "productId": "<PRODUCT_ID>",
  "warehouseId": "<WAREHOUSE_ID>",
  "quantity": 5,
  "orderId": "<ORDER_ID>",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```
**Expected**: 201 Created, reservation returned

#### 3.4 Get Product Inventory
```bash
GET /api/inventory/products/<PRODUCT_ID>
Authorization: Bearer <USER_TOKEN>
```
**Expected**: 200 OK, inventory summary with locations and available stock

---

## 4. Webhook System

### Test Cases

#### 4.1 Create Webhook
```bash
POST /api/webhooks
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "Order Webhook",
  "url": "https://example.com/webhooks/orders",
  "events": ["order.created", "order.updated"],
  "secret": "webhook_secret_key"
}
```
**Expected**: 201 Created, webhook object returned

#### 4.2 List Webhooks
```bash
GET /api/webhooks
Authorization: Bearer <ADMIN_TOKEN>
```
**Expected**: 200 OK, array of webhooks

#### 4.3 Test Webhook Delivery
- Create an order (triggers `order.created` event)
- Check webhook delivery history:
```bash
GET /api/webhooks/<WEBHOOK_ID>/deliveries
Authorization: Bearer <ADMIN_TOKEN>
```
**Expected**: 200 OK, delivery records showing webhook was called

---

## 5. Customer Groups

### Test Cases

#### 5.1 Create Customer Group
```bash
POST /api/customer-groups
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "VIP Customers",
  "description": "High-value customers",
  "discountPercentage": 10,
  "isDefault": false
}
```
**Expected**: 201 Created, customer group returned

#### 5.2 Assign User to Group
```bash
POST /api/customer-groups/<GROUP_ID>/assign/<USER_ID>
Authorization: Bearer <ADMIN_TOKEN>
```
**Expected**: 200 OK, user updated with group assignment

#### 5.3 List Customer Groups
```bash
GET /api/customer-groups
Authorization: Bearer <ADMIN_TOKEN>
```
**Expected**: 200 OK, array of customer groups

---

## 6. Return Policies

### Test Cases

#### 6.1 Create Return Policy
```bash
POST /api/return-policies
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "Standard Return Policy",
  "type": "PLATFORM_WIDE",
  "returnWindowDays": 30,
  "status": "ACTIVE"
}
```
**Expected**: 201 Created, return policy returned

#### 6.2 Evaluate Return Policy
```bash
POST /api/return-policies/evaluate
Authorization: Bearer <USER_TOKEN>
Body: {
  "orderId": "<ORDER_ID>",
  "productId": "<PRODUCT_ID>"
}
```
**Expected**: 200 OK, applicable return policy returned

---

## 7. Item-Level Returns

### Test Cases

#### 7.1 Create Return Request with Items
```bash
POST /api/returns
Authorization: Bearer <USER_TOKEN>
Body: {
  "orderId": "<ORDER_ID>",
  "reason": "Defective item",
  "items": [
    {
      "orderItemId": "<ORDER_ITEM_ID>",
      "quantity": 1,
      "reason": "Damaged"
    }
  ]
}
```
**Expected**: 201 Created, return request with items returned

#### 7.2 Get Return Request
```bash
GET /api/returns/<RETURN_ID>
Authorization: Bearer <USER_TOKEN>
```
**Expected**: 200 OK, return request with items array

---

## 8. Payment Provider Framework

### Test Cases

#### 8.1 Get Available Providers
```bash
GET /api/payments/providers
Authorization: Bearer <USER_TOKEN>
```
**Expected**: 200 OK, array of available providers (e.g., ["stripe", "klarna"])

#### 8.2 Create Payment Intent with Provider
```bash
POST /api/payments/intent
Authorization: Bearer <USER_TOKEN>
Body: {
  "orderId": "<ORDER_ID>",
  "paymentMethod": "stripe"
}
```
**Expected**: 201 Created, payment intent with clientSecret

#### 8.3 Confirm Payment
```bash
POST /api/payments/confirm
Authorization: Bearer <USER_TOKEN>
Body: {
  "paymentIntentId": "<PAYMENT_INTENT_ID>",
  "orderId": "<ORDER_ID>"
}
```
**Expected**: 200 OK, payment confirmed

---

## 9. Tax Zones & Classes

### Test Cases

#### 9.1 Create Tax Zone
```bash
POST /api/tax/zones
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "UK Standard",
  "countries": [
    {
      "country": "GB"
    }
  ]
}
```
**Expected**: 201 Created, tax zone returned

#### 9.2 Create Tax Class
```bash
POST /api/tax/classes
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "name": "Standard Rate",
  "description": "Standard VAT rate"
}
```
**Expected**: 201 Created, tax class returned

#### 9.3 Create Tax Rate
```bash
POST /api/tax/rates
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "taxZoneId": "<ZONE_ID>",
  "taxClassId": "<CLASS_ID>",
  "rate": 0.20,
  "isInclusive": false
}
```
**Expected**: 201 Created, tax rate returned

#### 9.4 Calculate Tax
```bash
POST /api/tax/calculate
Body: {
  "amount": 100.00,
  "taxClassId": "<CLASS_ID>",
  "location": {
    "country": "GB",
    "postalCode": "SW1A 1AA"
  }
}
```
**Expected**: 200 OK, tax calculation with amount, tax, and total

---

## 10. API Versioning

### Test Cases

#### 10.1 Test Versioned Endpoint
```bash
GET /api/v1/products
```
**Expected**: 200 OK, products list (same as `/api/products`)

#### 10.2 Test Legacy Endpoint
```bash
GET /api/products
```
**Expected**: 200 OK, products list (backward compatible)

---

## Integration Test Script

Create a test script that runs all tests sequentially:

```bash
# Run all tests
pnpm test:integration

# Or run specific feature tests
pnpm test:promotions
pnpm test:shipping
pnpm test:inventory
```

---

## Frontend Integration Checklist

- [ ] Update cart page to show discounts from promotions
- [ ] Add coupon code input field to cart/checkout
- [ ] Display shipping options in checkout
- [ ] Show inventory availability on product pages
- [ ] Add customer group badge/indicator
- [ ] Display return policy information
- [ ] Add item-level return selection in returns UI
- [ ] Update payment page to show available providers
- [ ] Display tax breakdown in checkout
- [ ] Update API client with new endpoints

---

## Notes

- All endpoints require authentication unless marked as `@Public()`
- Use Swagger UI at `/api/docs` to test endpoints interactively
- Check database for data persistence after each test
- Verify error handling for invalid inputs
- Test edge cases (empty carts, zero stock, expired promotions, etc.)
