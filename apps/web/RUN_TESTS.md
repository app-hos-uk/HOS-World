# Running Browser Tests

## Quick Start

1. **Install dependencies** (if not already installed):
   ```bash
   cd apps/web
   pnpm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

3. **Start the dev server** (in a separate terminal):
   ```bash
   cd apps/web
   pnpm dev
   ```

4. **Run tests** (in another terminal):
   ```bash
   cd apps/web
   pnpm test:e2e
   ```

## Test Commands

### Run all tests
```bash
pnpm test:e2e
```

### Run tests with UI (interactive mode)
```bash
pnpm test:e2e:ui
```
This opens Playwright's UI where you can:
- See all tests
- Run individual tests
- Watch tests execute
- Debug tests step by step

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
pnpm test:e2e e2e/cart-checkout-payment.spec.ts
```

## What Tests Are Included

### Complete Flow Tests (`e2e/cart-checkout-payment.spec.ts`)
- ✅ Empty cart display
- ✅ Cart page structure
- ✅ Checkout page structure
- ✅ Payment page structure
- ✅ Error handling
- ✅ Loading states
- ✅ Responsive design
- ✅ API error handling
- ✅ Network timeout handling

### Example Tests (`e2e/example.spec.ts`)
- ✅ Homepage loads
- ✅ Products page loads

## Viewing Test Results

After tests complete, view the HTML report:
```bash
npx playwright show-report
```

## Troubleshooting

### "Browser not found" error
Run: `npx playwright install chromium`

### Port 3000 already in use
The tests automatically start the dev server. If port 3000 is busy:
1. Stop any running dev server
2. Or change the port in `playwright.config.ts`

### Tests timeout
- Make sure the dev server is running
- Check network connectivity
- Increase timeout in test or config

### Tests fail with "page not found"
- Make sure dev server is running on port 3000
- Check that the app is accessible at http://localhost:3000

## Next Steps

1. Run the tests to verify everything works
2. Add more test cases as needed
3. Integrate into CI/CD pipeline
4. Add visual regression tests if needed
