# How to Run Tests from Terminal

## Correct Path

You need to navigate to the project directory first. The project is located at:
```
/Users/apple/Desktop/HOS-latest Sabu/apps/web
```

## Step-by-Step Instructions

### 1. Navigate to the project directory:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
```

**Note:** The quotes are important because the directory name has a space in it ("HOS-latest Sabu").

### 2. Verify you're in the right place:
```bash
pwd
# Should show: /Users/apple/Desktop/HOS-latest Sabu/apps/web

ls package.json
# Should show: package.json
```

### 3. Run the tests:

**Option A: Headed mode (see browser):**
```bash
pnpm test:e2e:headed
```

**Option B: UI mode:**
```bash
pnpm test:e2e:ui
```

**Option C: Headless mode:**
```bash
pnpm test:e2e
```

**Option D: Direct Playwright command:**
```bash
npx playwright test --headed
```

## Quick Copy-Paste Commands

Copy and paste these commands one at a time:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm test:e2e:headed
```

Or for UI mode:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright test --ui
```

## Alternative: Use Full Path

You can also run from anywhere using the full path:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web" && pnpm test:e2e:headed
```

## Troubleshooting

If you get "command not found", make sure:
1. You're in the correct directory (check with `pwd`)
2. The package.json has the test scripts (check with `cat package.json | grep test`)
3. Dependencies are installed (run `pnpm install` if needed)

## Verify Installation

If tests don't run, verify Playwright is installed:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
npx playwright --version
```

If it's not installed:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm install
npx playwright install chromium
```
