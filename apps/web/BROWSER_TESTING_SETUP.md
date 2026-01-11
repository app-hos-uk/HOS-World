# Browser Testing Setup with Playwright

## Installation

The Playwright testing framework has been set up for automated browser testing. To install dependencies:

```bash
cd apps/web
pnpm install
```

This will install Playwright and its dependencies.

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e:ui
```

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

### Run tests in specific browser
```bash
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

## Test Files

### `e2e/cart-checkout-payment.spec.ts`
Comprehensive test suite for the complete flow:
- Cart page functionality
- Checkout page functionality
- Payment page functionality
- Error handling
- Loading states
- Responsive design
- API error handling

### `e2e/example.spec.ts`
Basic example tests for homepage and products page.

## Test Configuration

The test configuration is in `playwright.config.ts`:
- Base URL: `http://localhost:3000` (or set `PLAYWRIGHT_TEST_BASE_URL`)
- Automatically starts dev server before tests
- Tests run in parallel
- Screenshots and videos on failure
- HTML report generated after tests

## Environment Variables

Set `PLAYWRIGHT_TEST_BASE_URL` to test against a different URL:
```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 pnpm test:e2e
```

## Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Writing New Tests

1. Create a new test file in `e2e/` directory
2. Import `test` and `expect` from `@playwright/test`
3. Use `test.describe` to group related tests
4. Use `test.beforeEach` for setup
5. Write test cases using `test()` function

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Hello')).toBeVisible();
  });
});
```

## Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Wait for network idle** when page loads: `await page.waitForLoadState('networkidle')`
3. **Use meaningful test descriptions**
4. **Group related tests** with `test.describe`
5. **Clean up after tests** if needed
6. **Handle async operations** properly with `await`
7. **Use page object pattern** for complex pages

## CI/CD Integration

To run tests in CI/CD:
```bash
# Install browsers
npx playwright install --with-deps

# Run tests
pnpm test:e2e
```

## Troubleshooting

### Tests fail with "browser not found"
Run: `npx playwright install`

### Tests timeout
Increase timeout in `playwright.config.ts` or use `test.setTimeout()`

### Dev server not starting
Make sure port 3000 is available or change the port in config

### Tests are flaky
- Add proper waits
- Use `waitForLoadState`
- Check for race conditions
- Use `page.waitForSelector` instead of `page.locator().isVisible()`
