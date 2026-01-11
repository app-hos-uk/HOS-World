# Run Tests with Existing Server

## Problem
The Playwright webServer is trying to start a new dev server but timing out or conflicting with existing servers.

## Solution: Use Existing Server

If you already have a dev server running, tell Playwright to use it:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"

# Option 1: Start server manually first
# In one terminal:
pnpm dev

# In another terminal, run tests (they'll use existing server):
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test --workers=1 --project=chromium
```

## Or: Let Playwright Start Server

If no server is running, Playwright will start one. But you need to:

1. **Make sure ports are free:**
   ```bash
   # Kill any existing servers
   lsof -ti:3000 | xargs kill -9 2>/dev/null
   lsof -ti:3001 | xargs kill -9 2>/dev/null
   ```

2. **Then run tests:**
   ```bash
   cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
   npx playwright test --workers=1 --project=chromium
   ```

## Quick Test (Single Test)

To test if everything works, run just one simple test:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test e2e/example.spec.ts --workers=1 --project=chromium --headed
```

This will:
- Start server if needed
- Run just 2 simple tests
- Show browser (if --headed)
- Complete quickly

## Best Option: UI Mode

The UI mode handles server management better:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test --ui --project=chromium
```

This opens a web UI where you can:
- See all tests
- Run them individually
- Watch execution
- See results
