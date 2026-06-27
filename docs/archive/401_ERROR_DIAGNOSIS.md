# 401 Authentication Error - Diagnosis & Solution

## 🔍 Error Analysis

The error you're seeing:
```
Failed to load resource: the server responded with a status of 401
Error fetching admin dashboard: Error: Invalid or expired token
```

This indicates that when the frontend tries to fetch admin dashboard data, the authentication token is being rejected by the backend API.

---

## 🔎 Root Causes

Based on the codebase analysis, here are the most likely causes:

### 1. **Token Expiration (Most Likely)**
- **Default token expiration**: Access tokens expire in **15 minutes** (as configured in `auth.service.ts:453`)
- If you logged in more than 15 minutes ago, your token has expired
- The frontend tries to refresh using the refresh token, but if that fails, you get a 401

### 2. **JWT_SECRET Mismatch**
- The token was generated with a different `JWT_SECRET` than what's currently configured in Railway
- This can happen if:
  - The JWT_SECRET environment variable was changed after login
  - The token was generated on a different environment (local vs production)

### 3. **Missing or Invalid Token**
- The token might not be stored in `localStorage` correctly
- The token might be corrupted or malformed
- The browser might have cleared localStorage

### 4. **Token Not Being Sent**
- The Authorization header might not be set correctly
- CORS issues preventing the header from being sent

---

## 🔧 How Authentication Works

1. **Login Flow:**
   ```
   User logs in → API generates JWT token (expires in 15m) + refresh token (expires in 30d)
   → Token stored in localStorage as 'auth_token'
   → Refresh token stored as 'refresh_token'
   ```

2. **API Request Flow:**
   ```
   Frontend makes request → Reads 'auth_token' from localStorage
   → Adds "Authorization: Bearer <token>" header
   → Backend JWT Strategy validates token using JWT_SECRET
   → If valid: Request proceeds
   → If invalid/expired: Returns 401
   ```

3. **Token Refresh Flow:**
   ```
   On 401 error → Frontend tries to refresh using 'refresh_token'
   → If refresh succeeds: New tokens stored, request retried
   → If refresh fails: User redirected to login
   ```

---

## ✅ Solutions

### Solution 1: Log In Again (Quick Fix)
**If your token expired:**
1. Go to: https://hos-marketplaceweb-production.up.railway.app/login
2. Log in with your admin credentials
3. This will generate a new token that's valid for 15 minutes

### Solution 2: Check Token in Browser Console
**To diagnose the issue:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run this command:
   ```javascript
   console.log('Token:', localStorage.getItem('auth_token'));
   console.log('Refresh Token:', localStorage.getItem('refresh_token'));
   ```

4. If tokens are `null`, you need to log in again

5. If tokens exist, check if they're expired:
   ```javascript
   const token = localStorage.getItem('auth_token');
   if (token) {
     const payload = JSON.parse(atob(token.split('.')[1]));
     const expiration = new Date(payload.exp * 1000);
     console.log('Token expires at:', expiration);
     console.log('Current time:', new Date());
     console.log('Is expired:', expiration < new Date());
   }
   ```

### Solution 3: Verify JWT_SECRET Configuration
**Check if JWT_SECRET is set correctly in Railway:**

1. Go to Railway Dashboard: https://railway.app
2. Navigate to your project → `@hos-marketplace/api` service
3. Go to Variables tab
4. Verify `JWT_SECRET` is set and has at least 32 characters
5. Verify `JWT_EXPIRES_IN` is set (default: `15m` or `7d`)

### Solution 4: Check API URL Configuration
**Verify the frontend is pointing to the correct API:**

1. In Railway Dashboard → `@hos-marketplace/web` service → Variables
2. Check `NEXT_PUBLIC_API_URL` matches your API URL:
   ```
   NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api/v1
   ```

3. Verify the API is accessible:
   ```bash
   curl https://hos-marketplaceapi-production.up.railway.app/api/health
   ```

### Solution 5: Increase Token Expiration (If Needed)
**If 15 minutes is too short for your use case:**

1. In Railway Dashboard → `@hos-marketplace/api` service → Variables
2. Add/Update: `JWT_EXPIRES_IN=1h` (or `7d` for 7 days)
3. Redeploy the API service
4. Users will need to log in again to get tokens with new expiration

---

## 🧪 Testing Steps

1. **Clear localStorage and log in fresh:**
   ```javascript
   // In browser console
   localStorage.clear();
   // Then navigate to /login and log in
   ```

2. **Test API directly with token:**
   ```bash
   # Get token from browser localStorage
   TOKEN="your-token-here"
   
   # Test admin dashboard endpoint
   curl -H "Authorization: Bearer $TOKEN" \
        https://hos-marketplaceapi-production.up.railway.app/api/v1/dashboard/admin
   ```

3. **Check Railway API logs:**
   ```bash
   railway logs --service @hos-marketplace/api
   ```
   Look for JWT validation errors or authentication failures

---

## 📋 Checklist

- [ ] Token exists in localStorage (`auth_token`)
- [ ] Token is not expired (check expiration time)
- [ ] `JWT_SECRET` is set in Railway API service
- [ ] `JWT_EXPIRES_IN` is configured correctly
- [ ] `NEXT_PUBLIC_API_URL` points to correct API
- [ ] API service is running and accessible
- [ ] User has valid credentials and ADMIN role
- [ ] Refresh token exists and is valid

---

## 🚨 Immediate Action Items

1. **Log in again** to get a fresh token
2. **Check Railway environment variables** for JWT_SECRET
3. **Verify API is responding** to health checks
4. **Check browser console** for additional error details
5. **Check Railway logs** for backend authentication errors

---

## 💡 Prevention

To prevent this issue in the future:

1. **Implement automatic token refresh** - Already implemented in `ApiClient.tryRefreshToken()`
2. **Show user-friendly error messages** when token expires
3. **Use refresh tokens** for longer sessions (30 days)
4. **Monitor token expiration** and warn users before it expires
5. **Ensure consistent JWT_SECRET** across all environments

---

## 📞 Next Steps

If the issue persists after trying these solutions:

1. Check Railway deployment logs for the API service
2. Verify database connection (token validation queries the database)
3. Ensure the user exists and has the ADMIN role
4. Check CORS configuration if requests are being blocked
5. Review the JWT strategy validation logic
