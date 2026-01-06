# Super Admin Login & Testing Guide

## Overview
This guide covers creating, verifying, and testing the super admin user login functionality for the HOS application.

## Super Admin Credentials

**Email:** `app@houseofspells.co.uk`  
**Password:** `Admin123`  
**Role:** `ADMIN`

## Step 1: Create/Verify Super Admin User

### Option A: Using Script (Recommended)

#### Local Development
```bash
cd services/api
pnpm db:seed-admin
```

#### Railway (Production)
```bash
cd services/api
railway run pnpm db:seed-admin
```

This script will:
- Check if admin user exists
- Create admin if it doesn't exist
- Update role to ADMIN if needed
- Set password to `Admin123` (pre-hashed)

### Option B: Verify Existing Admin

#### Local Development
```bash
cd services/api
pnpm db:verify-admin
```

#### Railway (Production)
```bash
cd services/api
railway run pnpm db:verify-admin
```

Expected output:
```
✅ Admin user EXISTS in database
📋 Admin Details:
   ID: [uuid]
   Email: app@houseofspells.co.uk
   Role: ADMIN
   Name: Super Admin
✅ Status: User has ADMIN role - Ready to use!
```

## Step 2: Test Login via API

### Using cURL

#### Local Development
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

#### Production (Railway)
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

**Expected Success Response:**
```json
{
  "data": {
    "user": {
      "id": "[uuid]",
      "email": "app@houseofspells.co.uk",
      "firstName": "Super",
      "lastName": "Admin",
      "role": "ADMIN",
      ...
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

**Error Response (Invalid Credentials):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

## Step 3: Test Login via Frontend

### Local Development
1. Start the frontend:
   ```bash
   cd apps/web
   pnpm dev
   ```

2. Navigate to: `http://localhost:3000/login`

3. Enter credentials:
   - **Email:** `app@houseofspells.co.uk`
   - **Password:** `Admin123`

4. Click "Login"

5. **Expected Behavior:**
   - Successful login redirects to home page (`/`)
   - Token is stored in `localStorage` as `auth_token`
   - No error messages displayed

### Production (Railway)
1. Navigate to: `https://hos-marketplaceweb-production.up.railway.app/login`

2. Enter credentials:
   - **Email:** `app@houseofspells.co.uk`
   - **Password:** `Admin123`

3. Click "Login"

4. **Expected Behavior:**
   - Successful login redirects to home page
   - Token stored in browser localStorage
   - User is authenticated

## Step 4: Verify Authentication

### Check Browser Console
After successful login, check browser console (F12):
- No CORS errors
- No 401/403 errors
- Token should be in localStorage

### Check Network Tab
1. Open DevTools → Network tab
2. Look for `/api/auth/login` request
3. Status should be `200 OK`
4. Response should contain `token` and `user` data

## Troubleshooting

### Issue 1: "Invalid credentials" Error

**Possible Causes:**
1. Password hash mismatch
2. User doesn't exist
3. Wrong email address

**Solution:**
```bash
# Recreate admin with correct password
cd services/api
pnpm db:seed-admin
```

### Issue 2: CORS Error

**Symptoms:**
```
Access to fetch at 'http://localhost:3001/api/auth/login' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
- Check `FRONTEND_URL` environment variable in API service
- Verify CORS configuration in `services/api/src/main.ts`
- Ensure frontend URL is in allowed origins list

### Issue 3: Database Connection Error

**Symptoms:**
```
PrismaClientInitializationError: Can't reach database server
```

**Solution:**
- Verify `DATABASE_URL` is set correctly
- Check database is running
- For Railway: Ensure database service is connected

### Issue 4: Frontend Still Using localhost

**Symptoms:**
- Frontend making requests to `http://localhost:3001` in production

**Solution:**
- Verify `NEXT_PUBLIC_API_URL` is set in Railway frontend service
- Check Dockerfile has build argument: `ARG NEXT_PUBLIC_API_URL`
- Force redeploy frontend service

### Issue 5: Password Hash Issues

**Symptoms:**
- Login fails even with correct password
- Error: "Invalid credentials"

**Solution:**
```bash
# Use the fix-admin script
cd services/api
pnpm db:fix-admin
```

Or manually update in database:
```sql
UPDATE users 
SET password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    role = 'ADMIN',
    "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';
```

## Login Flow Diagram

```
User enters credentials
    ↓
Frontend: apiClient.login({ email, password })
    ↓
API: POST /api/auth/login
    ↓
AuthService.login()
    ↓
1. Find user by email
2. Compare password with bcrypt.compare()
3. Generate JWT tokens
4. Return user + tokens
    ↓
Frontend: Store token in localStorage
    ↓
Redirect to home page (/)
```

## API Endpoints

### Login Endpoint
- **URL:** `/api/auth/login`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }
  ```
- **Response:**
  ```json
  {
    "data": {
      "user": { ... },
      "token": "jwt-token",
      "refreshToken": "refresh-token"
    },
    "message": "Login successful"
  }
  ```

## Security Notes

1. **Password Hash:** The password is stored as a bcrypt hash (10 salt rounds)
2. **JWT Tokens:** Tokens are used for authenticated requests
3. **Token Storage:** Tokens are stored in browser localStorage
4. **Password Change:** Admin should change password after first login

## Quick Test Checklist

- [ ] Admin user exists in database
- [ ] Admin has `ADMIN` role
- [ ] Password hash is correct
- [ ] API login endpoint responds with 200
- [ ] Frontend login form works
- [ ] Token is stored in localStorage
- [ ] Redirect to home page works
- [ ] No CORS errors
- [ ] No console errors

## Next Steps After Login

1. **Change Password:** Implement password change functionality
2. **Dashboard Access:** Verify admin can access admin dashboard
3. **Role-Based Access:** Test admin-only features
4. **Session Management:** Test token refresh functionality

## Support Commands

```bash
# Create admin
pnpm db:seed-admin

# Verify admin
pnpm db:verify-admin

# Fix admin (recreate with correct hash)
pnpm db:fix-admin

# Test login via API
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

## Environment Variables Required

### API Service
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `FRONTEND_URL` - Frontend URL for CORS

### Frontend Service
- `NEXT_PUBLIC_API_URL` - API base URL (e.g., `https://hos-marketplaceapi-production.up.railway.app/api`)

---

**Last Updated:** Based on previous conversation history  
**Status:** Ready for testing







