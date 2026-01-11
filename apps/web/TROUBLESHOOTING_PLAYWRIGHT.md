# Troubleshooting Playwright UI Error -102

## Error Code -102
This error typically means the connection to the Playwright UI server was refused or couldn't be established.

## Solutions

### Solution 1: Run UI Mode Directly
Try running the UI mode with explicit command:
```bash
cd apps/web
npx playwright test --ui
```

### Solution 2: Check Port Availability
The UI server uses port 9323 by default. Check if it's available:
```bash
lsof -ti:9323
```
If something is using the port, kill it:
```bash
kill -9 $(lsof -ti:9323)
```

### Solution 3: Use Different Port
You can specify a different port:
```bash
npx playwright test --ui --port 9324
```

### Solution 4: Run Tests Without UI First
Verify tests work without UI:
```bash
cd apps/web
pnpm test:e2e
```

### Solution 5: Check Playwright Installation
Verify Playwright is properly installed:
```bash
cd apps/web
npx playwright --version
npx playwright install chromium
```

### Solution 6: Run in Headed Mode Instead
If UI mode doesn't work, use headed mode to see the browser:
```bash
cd apps/web
pnpm test:e2e:headed
```

### Solution 7: Check Dev Server
Make sure the dev server can start:
```bash
cd apps/web
pnpm dev
```
Then in another terminal, run tests:
```bash
cd apps/web
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test --ui
```

## Alternative: Use VS Code Extension
If the CLI UI doesn't work, you can use the Playwright VS Code extension:
1. Install "Playwright Test for VSCode" extension
2. Open the test files
3. Use the test runner in VS Code

## Manual Test Execution
If UI mode continues to fail, you can run tests manually:
```bash
# Run all tests
cd apps/web
pnpm test:e2e

# Run specific test file
npx playwright test e2e/cart-checkout-payment.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug
```
