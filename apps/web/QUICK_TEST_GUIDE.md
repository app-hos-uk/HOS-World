# Quick Test Guide - Alternative Methods

Since the UI mode is having connection issues, here are alternative ways to run the tests:

## Method 1: Run Tests Directly (Recommended)

Open a terminal and run:
```bash
cd apps/web
npx playwright test --ui
```

This should open the Playwright UI in your browser automatically.

## Method 2: Run Tests in Headed Mode (See Browser)

```bash
cd apps/web
pnpm test:e2e:headed
```

This will run tests with a visible browser window so you can see what's happening.

## Method 3: Run Tests Headless (Fast)

```bash
cd apps/web
pnpm test:e2e
```

This runs all tests in the background and shows results in the terminal.

## Method 4: Run Specific Test File

```bash
cd apps/web
npx playwright test e2e/cart-checkout-payment.spec.ts
```

## Method 5: Run Single Test

```bash
cd apps/web
npx playwright test -g "should display empty cart message"
```

## Method 6: Debug Mode (Step Through)

```bash
cd apps/web
npx playwright test --debug
```

This opens Playwright Inspector where you can step through tests.

## View Test Results

After tests complete, view the HTML report:
```bash
cd apps/web
npx playwright show-report
```

## If UI Mode Still Doesn't Work

1. **Check if dev server is running:**
   ```bash
   # In one terminal
   cd apps/web
   pnpm dev
   
   # In another terminal
   cd apps/web
   PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test --ui
   ```

2. **Try a different port:**
   ```bash
   npx playwright test --ui --port 9324
   ```

3. **Use VS Code Extension:**
   - Install "Playwright Test for VSCode" extension
   - Open test files in VS Code
   - Use the test runner panel

## Current Test Status

✅ Playwright is installed (v1.57.0)
✅ Tests are detected and can be listed
✅ Test files are properly configured

The tests are ready to run - just need to use the right command!
