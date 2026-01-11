# API Server Startup Guide

## Starting the Server

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm start:dev
```

---

## Expected Output

You should see:

```
> @hos-marketplace/api@1.0.0 dev
> nest start --watch

[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG [NestFactory] Starting Nest application...
[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG [InstanceLoader] ...
[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG [InstanceLoader] ...
[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG [Database] Database connected
[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG [NestApplication] Nest application successfully started
[Nest] XXXX  - MM/DD/YYYY, HH:MM:SS AM/PM     LOG Server running on http://localhost:3001
```

---

## Verify Server is Running

Once started, test the health endpoint:

```bash
# Health check (should work without auth)
curl http://localhost:3001/health

# Or check API version endpoint
curl http://localhost:3001/api/v1
```

---

## Test Phase 3 Endpoints

Once server is running, you can test:

### 1. Test Warehouses Endpoint
```bash
# Get authentication token first (see TEST_STOCK_TRANSFER.md)
TOKEN="your-jwt-token-here"

# Get all warehouses
curl -X GET http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Test Stock Transfers
```bash
# Create stock transfer
curl -X POST http://localhost:3001/api/v1/inventory/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWarehouseId": "warehouse-id",
    "toWarehouseId": "warehouse-id-2",
    "productId": "product-id",
    "quantity": 10
  }'
```

### 3. Test Tax Zones
```bash
# Get tax zones
curl -X GET http://localhost:3001/api/v1/tax/zones \
  -H "Authorization: Bearer $TOKEN"
```

---

## Common Issues

### Issue: Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**
```bash
# Find process using port 3001
lsof -ti:3001

# Kill it
kill -9 $(lsof -ti:3001)

# Or use a different port
PORT=3002 pnpm start:dev
```

### Issue: Database connection failed

**Error:**
```
Error: Can't reach database server
```

**Solution:**
1. Check your `.env` file has correct `DATABASE_URL`
2. Verify database is accessible
3. Check network connectivity

### Issue: Prisma client not generated

**Error:**
```
Cannot find module '@prisma/client'
```

**Solution:**
```bash
cd services/api
pnpm db:generate
```

### Issue: Missing dependencies

**Error:**
```
Cannot find module 'xxx'
```

**Solution:**
```bash
cd services/api
pnpm install
```

---

## Development Mode Features

When running with `pnpm start:dev`:
- ✅ **Hot Reload**: Changes to code automatically restart server
- ✅ **Watch Mode**: Watches for file changes
- ✅ **Verbose Logging**: More detailed error messages
- ✅ **Source Maps**: Better stack traces for debugging

---

## Stop the Server

Press `Ctrl+C` in the terminal to stop the server.

---

## Next Steps After Server Starts

1. ✅ Verify health endpoint responds
2. ✅ Test authentication endpoint
3. ✅ Test Phase 3 endpoints (warehouses, transfers, tax zones)
4. ✅ Test admin UI pages at `http://localhost:3000`
5. ✅ Check logs for any warnings or errors

---

## Useful Endpoints to Test

```bash
# Health check (public)
curl http://localhost:3001/health

# API info (public)
curl http://localhost:3001/api/v1

# Search products (public)
curl "http://localhost:3001/api/v1/search?q=wand"

# Login (get token)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```
