# 🚀 Quick Start - Run Phase 1 Tests

## 3 Simple Steps

### Step 1: Start API Server
**Terminal 1**:
```bash
cd services/api
pnpm dev
```
Wait for: `Application is running on: http://localhost:3001`

---

### Step 2: Start Frontend
**Terminal 2** (NEW terminal):
```bash
cd apps/web
pnpm dev
```
Wait for: `Ready` and `http://localhost:3000`

---

### Step 3: Run Tests
**Terminal 3** (NEW terminal):
```bash
./test-phase1-e2e.sh
```

---

## Expected Results

✅ **Success**: All 8 tests pass  
⚠️ **401 Errors**: Expected for protected endpoints (endpoints exist)  
❌ **Connection Errors**: Servers not ready (wait 15 seconds and retry)

---

## If Tests Fail

1. **Wait 15-20 seconds** after starting servers
2. **Verify servers are running**:
   ```bash
   curl http://localhost:3001/api/v1/health
   curl http://localhost:3000
   ```
3. **Check for port conflicts**:
   ```bash
   lsof -ti:3001  # Should show a process
   lsof -ti:3000  # Should show a process
   ```

---

## Full Documentation

- `TESTING_INSTRUCTIONS.md` - Complete guide
- `QUICK_TEST_GUIDE.md` - Manual UI testing
- `PHASE_1_E2E_TEST_PLAN.md` - Detailed scenarios

---

**That's it!** Open 3 terminals and run the commands above. 🎯
