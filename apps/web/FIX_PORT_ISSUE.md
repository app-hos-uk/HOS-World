# Fix Port Conflict Issue

## Problem
Ports 3000 and 3001 are already in use, so the dev server is trying to use port 3002. But Playwright is configured to test against port 3000.

## Solution Options

### Option 1: Stop Existing Servers (Recommended)

In a new terminal, run:
```bash
# Stop server on port 3000
lsof -ti:3000 | xargs kill -9

# Stop server on port 3001  
lsof -ti:3001 | xargs kill -9
```

Then run tests again:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
pnpm test:e2e:headed
```

### Option 2: Use Existing Server

If you already have a dev server running on port 3000 or 3001, you can tell Playwright to use it:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"

# If server is on port 3000:
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test --headed

# If server is on port 3001:
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001 npx playwright test --headed
```

### Option 3: Let Playwright Start Its Own Server

The current setup should work - Playwright will wait for the server to be ready on whatever port it uses. Just wait a bit longer for the server to fully start.

## Check What's Running

To see what's using the ports:
```bash
lsof -i :3000
lsof -i :3001
lsof -i :3002
```

## Current Status

Your tests are starting! The server is launching on port 3002. Playwright should detect this, but if tests fail to connect, use one of the solutions above.
