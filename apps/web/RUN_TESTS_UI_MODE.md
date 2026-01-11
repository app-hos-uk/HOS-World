# Run Tests in UI Mode (Best for Viewing)

## Why UI Mode is Better

The Playwright UI mode is better than headed mode because:
- ✅ Opens in your default browser (not hidden windows)
- ✅ Shows all tests in a nice interface
- ✅ Lets you run tests individually
- ✅ Shows browser windows properly when tests execute
- ✅ Better debugging experience

## How to Run

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test --ui
```

This will:
1. Start the Playwright UI server
2. Open a browser window automatically
3. Show the Playwright Test UI
4. Let you see and run all tests

## In the UI

1. **See all tests** - Browse test files and individual tests
2. **Run tests** - Click play button or individual tests
3. **Watch execution** - See tests run in real-time
4. **View results** - See pass/fail status
5. **Debug** - Use debug button to step through tests

## If UI Doesn't Open Automatically

The UI should open automatically, but if it doesn't:
1. Check terminal for the URL (usually `http://localhost:9323`)
2. Open that URL in your browser manually
3. Or try a different port: `npx playwright test --ui --port 9324`

## Alternative: View Results After Running

If you just want to see test results:

```bash
# Run tests (headless - fast)
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm test:e2e

# View HTML report with screenshots
npx playwright show-report
```

The HTML report shows:
- All test results
- Screenshots of failures
- Videos of test execution
- Timeline of what happened
