# 🧪 Running Phase 1 Tests - Manual Instructions

## Current Status

The automated test script has been created and is ready to run. However, due to sandbox restrictions, you'll need to run the tests manually in your terminal.

---

## Step-by-Step Instructions

### Step 1: Start API Server

**Open Terminal 1** and run:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm start:dev
```

**Wait for**:
```
[Nest] INFO  [NestFactory] Nest application successfully started
[Nest] INFO  [Nest] Application is running on: http://localhost:3001
```

**Keep this terminal open** - Don't close it!

---

### Step 2: Start Frontend Server

**Open Terminal 2** (NEW terminal) and run:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm dev
```

**Wait for**:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

**Keep this terminal open** - Don't close it!

---

### Step 3: Run Automated Tests

**Open Terminal 3** (NEW terminal) and run:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
./test-phase1-e2e.sh
```

**Expected Output** (if servers are running):
```
🧪 Phase 1 E2E Test Suite
=========================
API URL: http://localhost:3001/api
Frontend URL: http://localhost:3000

📋 Test 1: API Health Check
---------------------------
✅ PASS: API health check

📋 Test 2: API Versioning
-------------------------
✅ PASS: v1 products endpoint accessible
✅ PASS: Legacy products endpoint still works

📋 Test 3: Promotions API
-------------------------
✅ PASS: Promotions endpoint accessible
✅ PASS: Coupon validation endpoint accessible

📋 Test 4: Shipping API
-----------------------
✅ PASS: Shipping methods endpoint accessible
✅ PASS: Shipping options calculation endpoint accessible

📋 Test 5: API Documentation
----------------------------
✅ PASS: Swagger documentation accessible

=========================
📊 Test Summary
=========================
Passed: 8
Failed: 0
Total: 8

✅ All tests passed!
```

**Note**: Some tests may show 401 (Unauthorized) - this is **expected** for protected endpoints. The test verifies the endpoint exists, not that authentication works.

---

## Alternative: Use Helper Script

If you prefer, you can use the helper script:

```bash
# Start both servers
./start-servers.sh

# In another terminal, run tests
./test-phase1-e2e.sh

# When done, stop servers
./stop-servers.sh
```

---

## Troubleshooting

### Issue: "API server not ready"

**Solution**:
1. Check if API server is running: `lsof -ti:3001`
2. Check API server logs: Look at Terminal 1 output
3. Common issues:
   - Database not connected (check `.env` file)
   - Port 3001 already in use
   - Dependencies not installed (`pnpm install`)

### Issue: "Frontend not ready"

**Solution**:
1. Check if Frontend is running: `lsof -ti:3000`
2. Check Frontend logs: Look at Terminal 2 output
3. Common issues:
   - Port 3000 already in use
   - Dependencies not installed (`pnpm install`)

### Issue: Tests fail with "HTTP 000000"

**This means**:
- Server is not running, OR
- Server is not ready yet, OR
- Network connection issue

**Solution**:
1. Wait 10-15 seconds after starting servers
2. Verify servers are running:
   ```bash
   curl http://localhost:3001/api/v1/health
   curl http://localhost:3000
   ```
3. If these work, re-run the test script

### Issue: Tests show 401 Unauthorized

**This is EXPECTED** for protected endpoints! The test verifies:
- ✅ Endpoint exists
- ✅ Endpoint is accessible
- ⚠️ Authentication required (which is correct)

**To test authenticated endpoints**:
1. Get JWT token (login via frontend or API)
2. Set environment variable:
   ```bash
   export ADMIN_TOKEN="your-jwt-token-here"
   ```
3. Re-run tests: `./test-phase1-e2e.sh`

---

## Quick Verification

Before running tests, verify servers are ready:

```bash
# Check API server
curl http://localhost:3001/api/v1/health
# Should return: {"status":"ok",...}

# Check Frontend
curl -I http://localhost:3000
# Should return: HTTP/1.1 200 OK

# Check Swagger
curl -I http://localhost:3001/api/docs
# Should return: HTTP/1.1 200 OK
```

---

## Test Results Interpretation

### ✅ All Tests Pass
**Meaning**: All endpoints are accessible and working correctly.

**Next Steps**:
1. Proceed with manual testing (see `QUICK_TEST_GUIDE.md`)
2. Document results
3. Move to production deployment

### ⚠️ Some Tests Fail (401 Unauthorized)
**Meaning**: Endpoints exist but require authentication.

**This is OK** - The endpoints are working correctly, they just need authentication.

**Next Steps**:
1. Test authenticated endpoints manually via Swagger
2. Or set `ADMIN_TOKEN` environment variable and re-run

### ❌ Tests Fail (Connection Refused / HTTP 000000)
**Meaning**: Servers are not running or not ready.

**Next Steps**:
1. Verify servers are running
2. Wait a bit longer for servers to start
3. Check server logs for errors
4. Re-run tests

---

## Next Steps After Tests

1. ✅ Review test results
2. ✅ Fix any critical issues
3. ✅ Run manual tests (see `QUICK_TEST_GUIDE.md`)
4. ✅ Document results in `PHASE_1_COMPLETION_CHECKLIST.md`
5. ✅ Proceed to production if all tests pass

---

## Quick Commands Reference

```bash
# Start servers manually
cd services/api && pnpm start:dev      # Terminal 1
cd apps/web && pnpm dev                # Terminal 2

# Or use helper script
./start-servers.sh                     # Starts both

# Run tests
./test-phase1-e2e.sh                  # Terminal 3

# Stop servers
./stop-servers.sh                     # Or Ctrl+C in each terminal

# Check if servers are running
lsof -ti:3001  # API server
lsof -ti:3000  # Frontend

# View server logs
tail -f /tmp/api-server.log      # API logs (if using helper script)
tail -f /tmp/frontend-server.log # Frontend logs (if using helper script)
```

---

**Ready to test?** Follow the steps above. The test script is ready and waiting! 🚀
