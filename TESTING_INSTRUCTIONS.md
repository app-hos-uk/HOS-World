# 🧪 Phase 1 Testing - Complete Instructions

## ⚠️ Important Note

Due to sandbox restrictions, the automated tests need to be run **manually in your terminal**. All test scripts and documentation are ready - you just need to execute them.

---

## Quick Start (3 Terminals)

### Terminal 1: API Server

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```

**Wait for**: `Application is running on: http://localhost:3001`

---

### Terminal 2: Frontend Server

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm dev
```

**Wait for**: `Ready` message and `http://localhost:3000`

---

### Terminal 3: Run Tests

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
./test-phase1-e2e.sh
```

---

## What the Tests Check

The automated test script (`test-phase1-e2e.sh`) verifies:

1. ✅ **API Health Check** - Server is running
2. ✅ **API Versioning** - v1 endpoints work, legacy endpoints still work
3. ✅ **Promotions API** - Endpoints are accessible
4. ✅ **Shipping API** - Endpoints are accessible
5. ✅ **Swagger Documentation** - API docs are available

---

## Expected Test Results

### ✅ Success (All Tests Pass)
```
📊 Test Summary
=========================
Passed: 8
Failed: 0
Total: 8

✅ All tests passed!
```

### ⚠️ Partial Success (401 Errors)
Some tests may show `401 Unauthorized` - **This is EXPECTED** for protected endpoints. The test verifies the endpoint exists, which is correct.

### ❌ Failure (Connection Errors)
If you see `HTTP 000000` or connection errors:
- Servers aren't running yet (wait 10-15 seconds)
- Servers failed to start (check Terminal 1 & 2 for errors)
- Port conflicts (check if ports 3000/3001 are in use)

---

## Troubleshooting

### Problem: "Command not found: start:dev"

**Check** `services/api/package.json` for the correct script name. It might be:
- `start:dev`
- `dev`
- `start`

**Solution**: Use the correct command from package.json

### Problem: "Port already in use"

**Solution**:
```bash
# Kill processes on ports
lsof -ti:3001 | xargs kill -9  # API server
lsof -ti:3000 | xargs kill -9  # Frontend
```

### Problem: "Database connection failed"

**Solution**:
1. Check `.env` file in `services/api/`
2. Verify `DATABASE_URL` is correct
3. Ensure database is running

### Problem: Tests fail immediately

**Solution**:
1. Wait 15-20 seconds after starting servers
2. Verify servers are ready:
   ```bash
   curl http://localhost:3001/api/v1/health
   curl http://localhost:3000
   ```
3. If these work, re-run tests

---

## Manual Testing (After Automated Tests)

Once automated tests pass, follow `QUICK_TEST_GUIDE.md` for manual UI testing:

1. **Coupon Application** - Test in cart page
2. **Shipping Calculation** - Test in checkout page
3. **Complete Flow** - Cart → Checkout → Payment

---

## All Testing Resources

1. ✅ `test-phase1-e2e.sh` - Automated API tests
2. ✅ `QUICK_TEST_GUIDE.md` - Manual testing guide
3. ✅ `PHASE_1_E2E_TEST_PLAN.md` - Detailed test scenarios
4. ✅ `PHASE_1_COMPLETION_CHECKLIST.md` - Verification checklist
5. ✅ `START_TESTING.md` - Complete testing guide
6. ✅ `start-servers.sh` - Helper to start both servers
7. ✅ `stop-servers.sh` - Helper to stop both servers

---

## Next Steps

1. ✅ **Run automated tests** (this document)
2. ✅ **Run manual tests** (`QUICK_TEST_GUIDE.md`)
3. ✅ **Document results** (`PHASE_1_COMPLETION_CHECKLIST.md`)
4. ✅ **Fix any issues** found
5. ✅ **Proceed to production** if all tests pass

---

**Ready?** Open 3 terminals and follow the Quick Start instructions above! 🚀
