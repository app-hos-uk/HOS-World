# Fix: Browser Closing Immediately

## Issues Found

1. **Browsers closing too quickly** - Chromium launches but closes immediately
2. **Permission errors** - `kill EPERM` and `kill ESRCH` errors when trying to close browsers
3. **Firefox/WebKit not installed** - Need to install or remove from config

## Fixes Applied

1. ✅ **Reduced parallel workers** - Changed from 4 to 1 to avoid conflicts
2. ✅ **Disabled parallel execution** - Set `fullyParallel: false`
3. ✅ **Increased timeouts** - Added longer timeouts for actions and navigation
4. ✅ **Removed Firefox/WebKit** - Only using Chromium (which is installed)
5. ✅ **Better page loading** - Changed to `domcontentloaded` instead of `networkidle`

## Run Tests Again

Now try running tests with only Chromium:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm test:e2e:headed
```

Or run headless (faster, no windows):

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm test:e2e
```

## If Browsers Still Close

The issue might be that browsers are being killed by the system. Try:

1. **Run with single worker explicitly:**
   ```bash
   npx playwright test --workers=1 --project=chromium
   ```

2. **Run a single test to debug:**
   ```bash
   npx playwright test e2e/example.spec.ts --workers=1 --project=chromium
   ```

3. **Use UI mode instead** (most reliable):
   ```bash
   npx playwright test --ui --project=chromium
   ```

## Install Other Browsers (Optional)

If you want to test in Firefox/WebKit later:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm exec playwright install firefox webkit
```

Then uncomment those projects in `playwright.config.ts`.
