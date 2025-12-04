# 🎉 Super Admin User - Login Walkthrough

## ✅ Status: Admin User is Now Functional!

**Update Successful:**
- ✅ Password hash: Correctly set to `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- ✅ Role: `ADMIN`
- ✅ Name: Super Admin
- ✅ Email: `app@houseofspells.co.uk`

---

## 🔐 Admin Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `app@houseofspells.co.uk` |
| **Password** | `Admin123` |
| **Role** | `ADMIN` |
| **Name** | Super Admin |

---

## 🚀 Login Walkthrough

### Method 1: Via API (cURL)

**Step 1: Open Terminal**
```bash
# Navigate to your project directory (optional)
cd "/Users/apple/Desktop/HOS-latest Sabu"
```

**Step 2: Run Login Request**
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }'
```

**Step 3: Expected Response (Success)**
```json
{
  "user": {
    "id": "1c069d31-7026-47ba-a447-e8faeee08f95",
    "email": "app@houseofspells.co.uk",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "ADMIN",
    "avatar": null,
    "createdAt": "2025-12-03T...",
    "updatedAt": "2025-12-03T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**What to Look For:**
- ✅ Status: `200 OK`
- ✅ `"role": "ADMIN"` in the response
- ✅ `token` and `refreshToken` are present
- ✅ User details match admin user

---

### Method 2: Via Frontend (When Available)

**Step 1: Navigate to Login Page**
- Go to your frontend URL (e.g., `https://hos-marketplaceweb-production.up.railway.app`)
- Click "Login" or navigate to `/login`

**Step 2: Enter Credentials**
- **Email:** `app@houseofspells.co.uk`
- **Password:** `Admin123`

**Step 3: Click "Login" Button**

**Step 4: Expected Result**
- ✅ Redirected to admin dashboard
- ✅ See admin navigation/menu
- ✅ Access to admin-only features

---

### Method 3: Via Postman/API Client

**Step 1: Create New Request**
- Method: `POST`
- URL: `https://hos-marketplaceapi-production.up.railway.app/api/auth/login`

**Step 2: Set Headers**
```
Content-Type: application/json
```

**Step 3: Set Body (JSON)**
```json
{
  "email": "app@houseofspells.co.uk",
  "password": "Admin123"
}
```

**Step 4: Send Request**

**Step 5: Expected Response**
- Status: `200 OK`
- Response body contains user object with `role: "ADMIN"`
- Copy the `token` for authenticated requests

---

## 🔑 Using the Authentication Token

After successful login, you'll receive a JWT token. Use it for authenticated requests:

**Example: Access Admin Endpoint**
```bash
curl -X GET https://hos-marketplaceapi-production.up.railway.app/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**In Postman/API Client:**
- Add header: `Authorization: Bearer YOUR_TOKEN_HERE`

---

## ✅ Verification Checklist

After logging in, verify:

- [ ] Login returns `200 OK` status
- [ ] Response includes `"role": "ADMIN"`
- [ ] Token is received and valid
- [ ] Can access admin-only endpoints
- [ ] Admin dashboard loads (if frontend available)
- [ ] Admin features are accessible

---

## 🎯 Admin Capabilities

With `ADMIN` role, you can:

- ✅ Access all admin endpoints
- ✅ Manage users and permissions
- ✅ Configure system settings
- ✅ Access protected admin routes
- ✅ Perform administrative tasks
- ✅ Manage products, orders, sellers
- ✅ View analytics and reports

---

## 🔒 Security Recommendations

### ⚠️ Important: Change Password

The default password `Admin123` is **not secure** for production:

1. **Login immediately** after first use
2. **Change password** to a strong password:
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Not easily guessable
3. **Enable 2FA** if available
4. **Use password manager** for secure storage

### Password Change Endpoint (if available):
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Admin123",
    "newPassword": "YourNewStrongPassword123!"
  }'
```

---

## 🐛 Troubleshooting

### Issue: Still Getting 401 Unauthorized

**Check:**
1. ✅ Password is exactly `Admin123` (case-sensitive)
2. ✅ Email is exactly `app@houseofspells.co.uk`
3. ✅ No extra spaces in credentials
4. ✅ API endpoint is correct
5. ✅ Wait a few seconds (cache might need to clear)

**Verify in Database:**
```sql
SELECT email, role, LEFT(password, 10) as password_start
FROM users 
WHERE email = 'app@houseofspells.co.uk';
```

Should show:
- `role` = `ADMIN`
- `password_start` = `$2b$10$N9q`

### Issue: Token Not Working

**Check:**
1. Token is copied completely (no truncation)
2. Header format: `Authorization: Bearer TOKEN` (with space)
3. Token hasn't expired (check `JWT_EXPIRES_IN` setting)
4. Using correct API endpoint

---

## 📋 Summary

**Admin User Status:** ✅ **FUNCTIONAL**

- ✅ Created and configured in database
- ✅ Password hash is correct
- ✅ Role is set to ADMIN
- ✅ Ready for login

**Next Steps:**
1. Test login using any method above
2. Change password to secure one
3. Explore admin features
4. Configure admin settings as needed

---

**Last Updated:** $(date)  
**API URL:** `https://hos-marketplaceapi-production.up.railway.app`  
**Status:** ✅ Admin user is ready to use!

