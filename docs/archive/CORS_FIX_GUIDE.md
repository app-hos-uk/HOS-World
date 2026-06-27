# CORS Error Fix Guide

## Problem
The API is blocking requests from the frontend because `FRONTEND_URL` is set to `https://placeholder.railway.app` instead of the actual frontend URL.

## Error Message
```
Access-Control-Allow-Origin header has a value 'https://placeholder.railway.app' 
that is not equal to the supplied origin 'https://hos-marketplaceweb-production.up.railway.app'
```

## Solution

### Step 1: Update FRONTEND_URL in Railway

1. Go to Railway Dashboard
2. Select the **`@hos-marketplace/api`** service (backend API)
3. Go to **Variables** tab
4. Find `FRONTEND_URL` variable
5. Update it to:
   ```
   https://hos-marketplaceweb-production.up.railway.app
   ```
6. **Save** the variable
7. **Restart** the API service (Railway should auto-restart, but if not, manually restart)

### Step 2: Verify the Fix

After updating and restarting:

1. Open incognito window
2. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
3. Open DevTools → Console
4. Try logging in
5. Check:
   - ✅ No CORS errors
   - ✅ Network request succeeds
   - ✅ Login works

## Code Changes Made

I've also updated `services/api/src/main.ts` to:
- Support multiple allowed origins
- Include the production frontend URL as a fallback
- Better error logging for CORS issues
- Support for common HTTP methods and headers

This makes the CORS configuration more robust and will prevent similar issues in the future.

## Current Status
✅ Code updated to support multiple origins
⏳ Waiting for you to update `FRONTEND_URL` in Railway
⏳ Then restart API service

