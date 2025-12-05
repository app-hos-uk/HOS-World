# Quick Admin Login Reference

## 🎯 Quick Start

### 1. Create/Update Super Admin
```bash
cd services/api
pnpm db:seed-admin
```

### 2. Verify Admin Exists
```bash
cd services/api
pnpm db:verify-admin
```

### 3. Test Login (API)
```bash
# Local
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'

# Production (Railway)
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

### 4. Test Login (Frontend)
- Navigate to: `http://localhost:3000/login` (local) or production URL
- Email: `app@houseofspells.co.uk`
- Password: `Admin123`
- Click "Login"

## 📋 Admin Credentials

| Field | Value |
|-------|-------|
| **Email** | `app@houseofspells.co.uk` |
| **Password** | `Admin123` |
| **Role** | `ADMIN` |
| **Password Hash** | `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` |

## 🔧 Available Scripts

```bash
# Create/Update admin user
pnpm db:seed-admin

# Verify admin exists and has correct role
pnpm db:verify-admin

# Fix admin (recreate with correct password hash)
pnpm db:fix-admin
```

## 🧪 Quick Test Script

Run the automated test:
```bash
./test-admin-login.sh
```

Or with custom API URL:
```bash
API_URL=https://your-api-url.com/api ./test-admin-login.sh
```

## ✅ Expected Login Response

```json
{
  "data": {
    "user": {
      "id": "[uuid]",
      "email": "app@houseofspells.co.uk",
      "firstName": "Super",
      "lastName": "Admin",
      "role": "ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

## 🐛 Common Issues & Fixes

### Issue: "Invalid credentials"
**Fix:**
```bash
pnpm db:seed-admin
```

### Issue: CORS Error
**Fix:** Check `FRONTEND_URL` in API environment variables

### Issue: Frontend using localhost in production
**Fix:** 
- Set `NEXT_PUBLIC_API_URL` in Railway frontend service
- Force redeploy frontend

### Issue: Database connection error
**Fix:** Verify `DATABASE_URL` is set correctly

## 📍 Login Flow

```
User Input → Frontend (apiClient.login)
    ↓
API: POST /api/auth/login
    ↓
AuthService.login()
    ├─ Find user by email
    ├─ Compare password (bcrypt.compare)
    ├─ Generate JWT tokens
    └─ Return user + tokens
    ↓
Frontend: Store token in localStorage
    ↓
Redirect to home page
```

## 🔍 Verification Checklist

- [ ] Admin user exists in database
- [ ] Admin has `ADMIN` role
- [ ] Password hash is correct
- [ ] API login returns 200 status
- [ ] Frontend login form works
- [ ] Token stored in localStorage
- [ ] No CORS errors
- [ ] Redirect works after login

## 📚 Full Documentation

See `ADMIN_LOGIN_TESTING_GUIDE.md` for complete testing guide.

## 🚀 Railway Commands

```bash
# Create admin on Railway
railway run pnpm db:seed-admin

# Verify admin on Railway
railway run pnpm db:verify-admin
```

---

**Quick Test:** Run `./test-admin-login.sh` to test login automatically!

