# Fix: Browser Not Showing in IDE

## Problem
Browsers appear in Mac Dock but don't open/display windows. This is a common issue with Playwright's headed mode.

## Solutions

### Solution 1: Use UI Mode (Recommended)
The Playwright UI mode works better for viewing tests:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test --ui
```

This opens the Playwright UI in your browser where you can:
- See all tests
- Run tests individually
- Watch them execute
- See browser windows properly

### Solution 2: Use Debug Mode
Debug mode shows the browser and lets you step through:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test --debug
```

### Solution 3: Force Browser to Front
Try bringing browser windows to front:

```bash
# In terminal, after tests start, try:
osascript -e 'tell application "Chromium" to activate'
```

### Solution 4: Check Display Settings
The browsers might be opening on a different display. Check:
- Mission Control (F3 or swipe up)
- Other desktops/spaces
- External displays

### Solution 5: Use Specific Browser Launch Options
Try with explicit launch options:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
PLAYWRIGHT_BROWSERS_PATH=/Users/apple/Library/Caches/ms-playwright npx playwright test --headed --project=chromium
```

### Solution 6: Check if Browsers Are Actually Running
```bash
ps aux | grep -i chromium | grep -v grep
```

If you see processes, the browsers are running but windows aren't showing.

## Best Option: Use UI Mode

The Playwright UI mode is the best way to see tests running:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test --ui
```

This will:
1. Open a web-based UI in your default browser
2. Show all tests
3. Let you run tests and see results
4. Display browser windows properly when tests run

## Alternative: View Test Results

Even if browsers don't show, you can view results:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm test:e2e  # Run headless
npx playwright show-report  # View HTML report
```

The HTML report shows screenshots and videos of test execution.
