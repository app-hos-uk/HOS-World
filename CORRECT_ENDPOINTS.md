# Correct API Endpoints

## ⚠️ Important: Routes are Versioned!

All routes use the `/api/v1/` prefix (not just `/api/`).

---

## ✅ Correct Endpoints

### Promotions

**GET all promotions:**
```bash
curl -X GET http://localhost:3001/api/v1/promotions
```

**POST validate coupon (Public - no auth needed):**
```bash
curl -X POST http://localhost:3001/api/v1/promotions/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "SUMMER20"}'
```

**POST create promotion (Requires auth):**
```bash
curl -X POST http://localhost:3001/api/v1/promotions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Summer Sale",
    "type": "PERCENTAGE",
    "value": 20,
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "status": "ACTIVE"
  }'
```

---

## All New Feature Endpoints

### Promotions
- `GET /api/v1/promotions` - List promotions
- `POST /api/v1/promotions/coupons/validate` - Validate coupon
- `POST /api/v1/promotions/coupons/apply` - Apply coupon to cart

### Shipping
- `GET /api/v1/shipping/methods` - List shipping methods
- `POST /api/v1/shipping/options` - Get shipping options

### Inventory
- `GET /api/v1/inventory/warehouses` - List warehouses
- `GET /api/v1/inventory/products/{productId}` - Get product inventory

### Payment Providers
- `GET /api/v1/payments/providers` - Get available providers

### Tax
- `POST /api/v1/tax/calculate` - Calculate tax
- `GET /api/v1/tax/zones` - List tax zones

### Customer Groups
- `GET /api/v1/customer-groups` - List customer groups

### Return Policies
- `GET /api/v1/return-policies` - List return policies

### Webhooks
- `GET /api/v1/webhooks` - List webhooks

---

## Quick Test Commands

```bash
# Promotions
curl http://localhost:3001/api/v1/promotions

# Validate coupon
curl -X POST http://localhost:3001/api/v1/promotions/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "SUMMER20"}'

# Payment providers
curl http://localhost:3001/api/v1/payments/providers

# Shipping methods
curl http://localhost:3001/api/v1/shipping/methods

# Health check
curl http://localhost:3001/api/v1/health
```

---

## Swagger UI

Visit: **http://localhost:3001/api/docs**

All endpoints are documented there with the correct paths.
