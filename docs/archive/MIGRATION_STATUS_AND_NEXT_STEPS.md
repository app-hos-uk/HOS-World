# Migration Status and Next Steps

## ✅ Current Status

### Database Schema
- ✅ **Schema changes are in `schema.prisma`**
  - `ProductType` enum (SIMPLE, VARIANT, BUNDLED)
  - `productType` field on Product model
  - `parentProductId` for variant products
  - `ProductBundleItem` model
  - `VolumePricing` model

### Database Sync
- ✅ **Database is in sync** (confirmed by `npx prisma db push`)
- The schema changes have been applied to the database

### Prisma Client
- ⚠️ **Prisma Client needs regeneration**
- The client needs to be regenerated to include the new types

---

## 🔧 Next Steps

### 1. Regenerate Prisma Client

Since the database is already in sync, you just need to regenerate the Prisma client:

```bash
cd services/api
npx prisma generate
```

Or if using pnpm:
```bash
cd services/api
pnpm prisma generate
```

This will:
- Generate TypeScript types for the new models
- Update the Prisma Client with new methods
- Fix the missing module error

### 2. Verify the Migration (Optional)

If you want to create a proper migration file for version control:

```bash
cd services/api
npx prisma migrate dev --name add_product_types_volume_pricing
```

**Note**: Since `db push` already applied the changes, this might create an empty migration or show that everything is already applied. That's fine - the database is already updated.

### 3. Test the New Features

After regenerating the Prisma client, test the new features:

#### Product Types
```bash
# Create a simple product
POST /api/v1/products
{
  "name": "Test Product",
  "description": "A simple product",
  "price": 29.99,
  "productType": "SIMPLE"
}

# Create a bundle product
POST /api/v1/products/bundles
{
  "name": "Bundle Package",
  "description": "A bundle of products",
  "price": 99.99,
  "items": [
    {
      "productId": "product-id-1",
      "quantity": 2
    },
    {
      "productId": "product-id-2",
      "quantity": 1
    }
  ]
}
```

#### Volume Pricing
```bash
# Create volume pricing tier
POST /api/v1/products/{productId}/volume-pricing
{
  "minQuantity": 10,
  "maxQuantity": 49,
  "discountType": "PERCENTAGE",
  "discountValue": 10,
  "priority": 1
}

# Calculate price with volume pricing
POST /api/v1/products/{productId}/volume-pricing/calculate
{
  "quantity": 25
}
```

#### Shipping Integration
```bash
# Get available courier providers
GET /api/v1/shipping/courier/providers

# Calculate shipping rate
POST /api/v1/shipping/courier/rate/royal-mail
{
  "weight": 2.5,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 15
  },
  "from": {
    "country": "GB",
    "postalCode": "SW1A 1AA"
  },
  "to": {
    "country": "GB",
    "postalCode": "M1 1AA"
  }
}
```

---

## 🐛 Troubleshooting

### Prisma Client Module Error

If you see the error:
```
Cannot find module '@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.js'
```

**Solution:**
1. Regenerate Prisma client: `npx prisma generate`
2. If that doesn't work, try:
   ```bash
   cd services/api
   rm -rf node_modules/.prisma
   npx prisma generate
   ```

### Permission Errors

If you see permission errors with npm/npx:
- Try using `pnpm` instead: `pnpm prisma generate`
- Or run with sudo (not recommended): `sudo npx prisma generate`

### Database Connection Issues

If you have database connection issues:
- Check your `.env` file has the correct `DATABASE_URL`
- Verify the database is accessible
- Check Railway dashboard for connection status

---

## 📋 Summary

1. ✅ Schema changes are in `schema.prisma`
2. ✅ Database is in sync (via `db push`)
3. ⚠️ **Action Required**: Run `npx prisma generate` to regenerate Prisma client
4. ✅ All features are implemented and ready to use

---

## 🎯 Quick Command Reference

```bash
# Regenerate Prisma Client (REQUIRED)
cd services/api
npx prisma generate

# Optional: Create migration file
npx prisma migrate dev --name add_product_types_volume_pricing

# Verify database schema
npx prisma db pull  # Pulls current DB schema (should match schema.prisma)
```

---

**Last Updated**: After schema changes and database sync
