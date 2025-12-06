# Admin Login Debugging Guide

## Issue
Unable to login as admin. Console shows favicon 404 error (harmless, but we'll fix it).

## Favicon Fix
✅ **Fixed**: Added favicon metadata to layout.tsx
- Favicon exists at `/public/favicon.svg`
- Now properly referenced in metadata

## Login Debugging Steps

### Step 1: Check Console for Real Errors
The favicon 404 is harmless. Look for:
- ❌ Network errors (CORS, 404, 500)
- ❌ JavaScript errors
- ❌ "Login error:" messages
- ❌ "API Request failed:" messages

### Step 2: Check Network Tab
1. Open DevTools → **Network** tab
2. Try to login
3. Look for request to `/api/auth/login`
4. Check:
   - **Status Code**: 200 = success, 401 = invalid credentials, 500 = server error
   - **Request Payload**: Should contain email and password
   - **Response**: Should contain token

### Step 3: Verify Admin Credentials
**Expected Credentials:**
- Email: `app@houseofspells.co.uk`
- Password: `Admin123`

**Test API Directly:**
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

### Step 4: Check Console Logs
After clicking Login, you should see:
1. `"Attempting login with email: app@houseofspells.co.uk"`
2. `"Login response received: {...}"`
3. `"Response structure: {...}"`

If you see errors instead:
- Check the error message
- Check the network request
- Verify API URL is correct

### Step 5: Common Issues

#### Issue: "Invalid credentials"
**Cause**: Wrong email or password
**Solution**: 
- Verify credentials are correct
- Check for typos
- Verify password hash in database

#### Issue: "No token received from server"
**Cause**: API response structure mismatch
**Solution**: 
- Check console logs for response structure
- Verify API is returning correct format
- Check network response

#### Issue: CORS Error
**Cause**: API URL pointing to wrong domain
**Solution**:
- Verify `NEXT_PUBLIC_API_URL` in Railway
- Should be: `https://hos-marketplaceapi-production.up.railway.app/api`
- Clear browser cache and rebuild

#### Issue: Network Error
**Cause**: API server down or unreachable
**Solution**:
- Check Railway API service status
- Verify API is deployed and running
- Check API logs in Railway

## Enhanced Error Logging

The code now includes:
- ✅ Detailed console logging
- ✅ Response structure validation
- ✅ Better error messages
- ✅ Network error details

## What to Check

1. **Console Tab**:
   - Look for "Login error:" messages
   - Check for "API Request failed:" messages
   - Verify response structure logs

2. **Network Tab**:
   - Find `/api/auth/login` request
   - Check status code
   - Check request/response payloads

3. **Application Tab** (DevTools):
   - Check localStorage for `auth_token`
   - Should be set after successful login

## Expected Flow

1. User enters credentials
2. Clicks "Login" button
3. Console shows: "Attempting login with email: ..."
4. Network request to `/api/auth/login`
5. Console shows: "Login response received: ..."
6. Console shows: "Response structure: ..."
7. Token saved to localStorage
8. Redirect to home page

## If Login Still Fails

1. **Check Console**: What error message appears?
2. **Check Network**: What's the response status?
3. **Check API**: Test with curl command above
4. **Check Credentials**: Verify in database
5. **Check Environment**: Verify API URL is correct

## Quick Test

**In Browser Console:**
```javascript
// Check API URL
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// Test login manually
fetch('https://hos-marketplaceapi-production.up.railway.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'app@houseofspells.co.uk',
    password: 'Admin123'
  })
})
.then(r => r.json())
.then(data => console.log('Login test:', data))
.catch(err => console.error('Login test error:', err));
```

---

**Status**: ✅ Favicon fixed, enhanced error logging added
**Next**: Check console for actual login errors (not just favicon)



