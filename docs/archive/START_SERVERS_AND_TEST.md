# 🚀 Start Servers and Run Tests - Step by Step

## Current Situation

- ✅ Frontend can start (you tested it)
- ❌ API server is NOT running (that's why tests fail)
- ✅ Test scripts are ready

---

## Step-by-Step Instructions

### Step 1: Start API Server

**Open Terminal 1** (or use your current terminal):

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```

**Wait for this message**:
```
[Nest] INFO  [NestFactory] Nest application successfully started
[Nest] INFO  [Nest] Application is running on: http://localhost:3001
```

**Keep this terminal open** - The API server must stay running!

---

### Step 2: Verify API Server is Running

**Open Terminal 2** (NEW terminal):

```bash
# Quick health check
curl http://localhost:3001/api/v1/health
```

**Expected output**: `{"status":"ok",...}` or similar JSON

If you get "Connection refused", wait 10-15 seconds and try again.

---

### Step 3: Run Tests

**In Terminal 2** (same terminal as Step 2):

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"

# Option 1: Use the helper script (checks if servers are running)
./run-tests.sh

# Option 2: Run tests directly
./test-phase1-curl.sh
```

---

## Quick Test Commands (Individual)

If you want to test endpoints one by one:

```bash
# Health check (should work immediately)
curl http://localhost:3001/api/v1/health

# Test versioning (may require auth)
curl "http://localhost:3001/api/v1/products?page=1&limit=1"
curl "http://localhost:3001/api/products?page=1&limit=1"

# Test promotions (requires auth)
curl http://localhost:3001/api/v1/promotions

# Test shipping (requires auth)
curl http://localhost:3001/api/v1/shipping/methods
```

**Note**: Use quotes around URLs with query parameters (`?page=1&limit=1`) to avoid shell interpretation issues.

---

## Troubleshooting

### Problem: "Connection refused" on port 3001

**Solution**:
1. Make sure API server is running (Terminal 1)
2. Wait 10-15 seconds after starting
3. Check if port is in use: `lsof -ti:3001`
4. If port is in use but server isn't responding, kill it: `lsof -ti:3001 | xargs kill -9`

### Problem: "zsh: no matches found" for URLs with `?`

**Solution**: Use quotes around URLs:
```bash
# Wrong (no quotes)
curl http://localhost:3001/api/v1/products?page=1&limit=1

# Correct (with quotes)
curl "http://localhost:3001/api/v1/products?page=1&limit=1"
```

### Problem: "cd: no such file or directory: services/api"

**Solution**: Make sure you're in the project root:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
cd services/api
```

### Problem: API server won't start

**Check**:
1. Database is running and accessible
2. `.env` file exists in `services/api/`
3. Dependencies installed: `cd services/api && pnpm install`

---

## Expected Test Results

When API server is running, you should see:

```
🧪 Phase 1 E2E Test Suite (curl-based)
=======================================
API URL: http://localhost:3001/api

📋 Test 1: API Health Check
---------------------------
✅ PASS: API v1 health check
✅ PASS: API legacy health check

📋 Test 2: API Versioning
-------------------------
✅ PASS: v1 products endpoint
✅ PASS: Legacy products endpoint

📊 Test Summary
=======================================
Passed: 6-8
Failed: 0
Skipped: 0-2 (if auth required)

✅ All accessible tests passed!
```

---

## Quick Start (All in One)

**Terminal 1**:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```

**Terminal 2** (wait 15 seconds, then):
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
./run-tests.sh
```

---

## What Each Test Does

1. **Health Check** - Verifies API server is responding
2. **API Versioning** - Tests both `/api/v1/*` and `/api/*` routes
3. **Promotions API** - Tests promotion endpoints
4. **Shipping API** - Tests shipping endpoints
5. **Swagger Docs** - Verifies API documentation is accessible

---

**Ready?** Start the API server in Terminal 1, wait 15 seconds, then run `./run-tests.sh` in Terminal 2! 🚀
