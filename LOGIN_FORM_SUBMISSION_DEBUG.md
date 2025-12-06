# Login Form Submission Debug Guide

## Issue
Form fields can be filled but form submission doesn't trigger API calls.

## Debugging Steps

### 1. Check Environment Variable
Verify `NEXT_PUBLIC_API_URL` is set in Railway frontend service:
- Should be: `https://hos-marketplaceapi-production.up.railway.app/api`
- Check: Railway Dashboard → Frontend Service → Variables

### 2. Manual Browser Test
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Go to **Network** tab
4. Navigate to: `https://hos-marketplaceweb-production.up.railway.app/login`
5. Enter credentials:
   - Email: `app@houseofspells.co.uk`
   - Password: `Admin123`
6. Click "Login" button
7. Check:
   - **Console**: Any JavaScript errors?
   - **Network**: Is there a request to `/api/auth/login`?
   - **Network**: What's the response status?

### 3. Check Form Handler
The form should have `onSubmit={handleLogin}` attached.

### 4. Test API Directly
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

### 5. Check Browser Console
Look for:
- JavaScript errors
- Network errors (CORS, 404, 500)
- Form validation errors

## Quick Fix Checklist

- [ ] Verify `NEXT_PUBLIC_API_URL` in Railway
- [ ] Check browser console for errors
- [ ] Verify form `onSubmit` handler
- [ ] Test API endpoint directly
- [ ] Check CORS configuration
- [ ] Verify form fields have `value` and `onChange` handlers



