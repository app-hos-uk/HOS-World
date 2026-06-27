# Reproduction Steps for Login Page Mount Loop

## Current Issue
Login page component is mounting 8+ times, causing instability.

## Debugging Setup Complete
✅ Comprehensive instrumentation has been added to track:
- Component mount/unmount cycles
- Pathname changes
- Router navigation events
- onUnauthorized callback triggers
- Parent component renders
- useEffect executions

## Next Steps

### Step 1: Wait for Deployment
The instrumentation code has been pushed. Wait 2-3 minutes for Railway to deploy the new code.

### Step 2: Clear Browser Cache
**IMPORTANT:** Clear your browser cache completely:
- Open DevTools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"
- OR use an incognito/private window

### Step 3: Navigate to Login Page
1. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
2. Open DevTools Console (F12 → Console tab)
3. Wait for the page to fully load

### Step 4: Observe and Wait
- Watch the console for mount messages
- Don't interact with the page yet
- Just observe the console logs for 10-15 seconds
- Count how many times you see: `[LOGIN FIX v2.0] Login page component mounted`

### Step 5: Check Log File
After waiting 15 seconds, the debug logs should be captured in:
`/Users/apple/Desktop/HOS-latest Sabu/.cursor/debug.log`

The logs will contain detailed information about:
- Every component mount with stack traces
- Pathname changes
- Navigation events
- onUnauthorized triggers
- Parent component renders

### Step 6: Share Results
1. Copy all console messages
2. Check if the log file exists and share its contents
3. Share the Network tab showing any `login?_rsc` requests

## What We're Looking For

The instrumentation will help us identify:
- **Hypothesis A:** React Strict Mode + RSC causing multiple mounts
- **Hypothesis B:** Navigation loop between routes
- **Hypothesis C:** Parent components remounting
- **Hypothesis D:** onUnauthorized callback triggering redirects
- **Hypothesis E:** useEffect dependency loops

## Notes
- The log file will be created automatically when logs are written
- All logs are sent to the debug endpoint in real-time
- Console logs will continue to work as before
- Debug logs include stack traces to identify callers

