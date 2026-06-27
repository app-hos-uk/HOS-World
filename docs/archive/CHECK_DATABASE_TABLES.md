# Check Database Tables - Stock Transfer & Movement

## Verify Tables Exist

Run these commands in your terminal (outside of Cursor):

```bash
cd services/api

# Check if stock_transfers and stock_movements tables exist
psql $DATABASE_URL -c "\dt stock_*"

# Expected output if tables exist:
#               List of relations
#  Schema |       Name        | Type  |  Owner
# --------+-------------------+-------+--------
#  public | stock_movements   | table | ...
#  public | stock_transfers   | table | ...

# Check enums exist
psql $DATABASE_URL -c "\dT+ TransferStatus"
psql $DATABASE_URL -c "\dT+ MovementType"

# Check table structure
psql $DATABASE_URL -c "\d stock_transfers"
psql $DATABASE_URL -c "\d stock_movements"

# Check indexes
psql $DATABASE_URL -c "\di stock_*"
```

---

## Alternative: Use Prisma Studio (GUI)

```bash
cd services/api
pnpm db:studio
```

Then in the browser:
1. Look for `StockTransfer` and `StockMovement` in the left sidebar
2. If they're missing, the tables don't exist yet

---

## If Tables Don't Exist

If you see "relation does not exist" or the tables are missing, apply the migration:

### Option A: Using db:push (Fastest)
```bash
cd services/api
pnpm db:push
```

### Option B: Using SQL migration
```bash
cd services/api
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
```

### Option C: Using Railway CLI (if deployed on Railway)
```bash
railway run psql $DATABASE_URL -c "\dt stock_*"
railway run psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
```

---

## Quick Check via API

Once your API is running, you can also check via the API endpoints:

```bash
# This will fail if tables don't exist, succeed if they do
curl -X GET "http://localhost:3001/api/v1/inventory/transfers" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check API logs for errors related to missing tables
```

---

## Troubleshooting

### Error: "psql: command not found"
Install PostgreSQL client:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Or use Docker
docker run -it postgres psql $DATABASE_URL
```

### Error: "connection refused" or "database does not exist"
Check your `DATABASE_URL`:
```bash
cd services/api
cat .env | grep DATABASE_URL
```

### Error: "permission denied"
Make sure your database user has CREATE TABLE permissions.

---

## Expected Tables After Migration

After successful migration, you should see:

1. **stock_transfers** table with columns:
   - id, fromWarehouseId, toWarehouseId, productId
   - quantity, status, requestedBy, completedBy
   - notes, completedAt, createdAt, updatedAt

2. **stock_movements** table with columns:
   - id, inventoryLocationId, productId, quantity
   - movementType, referenceType, referenceId
   - performedBy, notes, createdAt

3. **Enums**:
   - TransferStatus (PENDING, IN_TRANSIT, COMPLETED, CANCELLED, REJECTED)
   - MovementType (IN, OUT, ADJUST, RESERVE, RELEASE)

4. **Indexes** on both tables for performance
