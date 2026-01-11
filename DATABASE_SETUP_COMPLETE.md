# Database Setup - Status Check ✅

## Prisma Client Generated Successfully ✅

Your Prisma client has been generated with the new `StockTransfer` and `StockMovement` models.

## Next Steps

### 1. Apply Database Schema Changes

You have two options:

#### Option A: Using `db:push` (Recommended - Fast)
```bash
cd services/api
pnpm db:push
```

This will:
- ✅ Create `stock_transfers` table
- ✅ Create `stock_movements` table
- ✅ Create `TransferStatus` and `MovementType` enums
- ✅ Create all indexes and foreign keys
- ✅ Sync schema without migration history

#### Option B: Using SQL Migration (For Production)
```bash
cd services/api
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
```

This will:
- ✅ Apply the SQL migration directly
- ✅ Create proper migration history
- ✅ Better for production deployments

---

### 2. Verify Tables Were Created

After applying the schema, verify the tables exist:

```bash
# Using psql
psql $DATABASE_URL -c "\dt stock_*"

# Expected output:
#  stock_movements
#  stock_transfers

# Check enums
psql $DATABASE_URL -c "\dT+ TransferStatus"
psql $DATABASE_URL -c "\dT+ MovementType"
```

Or use Prisma Studio:
```bash
pnpm db:studio
```

---

### 3. Build and Test

Once schema is applied:

```bash
cd services/api
pnpm build
pnpm start:dev
```

---

### 4. Test the API Endpoints

Test the new endpoints:

```bash
# Create a stock transfer (requires warehouses and products to exist)
curl -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "warehouse-id",
    "toWarehouseId": "warehouse-id-2",
    "productId": "product-id",
    "quantity": 10,
    "notes": "Test transfer"
  }'

# Get stock transfers
curl -X GET "http://localhost:3001/api/v1/inventory/transfers" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get stock movements
curl -X GET "http://localhost:3001/api/v1/inventory/movements" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Verification Checklist

- [x] Prisma client generated successfully
- [ ] Database schema applied (`stock_transfers` and `stock_movements` tables exist)
- [ ] Enums created (`TransferStatus` and `MovementType`)
- [ ] Indexes created
- [ ] Foreign keys created
- [ ] API builds successfully
- [ ] API starts without errors
- [ ] Endpoints respond correctly

---

## Troubleshooting

### If `db:push` fails:
Check your `DATABASE_URL` is correct:
```bash
echo $DATABASE_URL
```

### If tables already exist:
The migration is idempotent (uses `IF NOT EXISTS`), so it's safe to run again.

### If you get foreign key errors:
Make sure these tables exist first:
- `warehouses`
- `inventory_locations`
- `products`

Run existing migrations if needed:
```bash
pnpm db:migrate:deploy
```

---

## Current Status

✅ **Prisma Client**: Generated successfully  
⏳ **Database Schema**: Needs to be applied (run `pnpm db:push`)  
⏳ **API Build**: Ready to build after schema is applied  
⏳ **Testing**: Ready to test after schema is applied  

---

**Next Action**: Run `pnpm db:push` to apply the schema changes to your database.
