# Testing Manual Seller Creation

## Quick Test

### Prerequisites
- Admin account credentials
- Node.js installed (for automated test)
- Or curl/bash (for manual test)

### Automated Test (Node.js)

```bash
# Set admin password and run
node test-seller-api.js YOUR_ADMIN_PASSWORD

# Or use environment variable
ADMIN_PASSWORD=yourpassword node test-seller-api.js
```

### Automated Test (Bash)

```bash
chmod +x test-seller-creation.sh
./test-seller-creation.sh app@houseofspells.co.uk YOUR_ADMIN_PASSWORD
```

### Manual Test Steps

#### 1. Get Admin Token

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "YOUR_ADMIN_PASSWORD"
  }'
```

**Save the `token` from response.**

#### 2. Create Seller

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/admin/sellers/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "test-seller-'$(date +%s)'@example.com",
    "password": "TestPassword123",
    "storeName": "Test Store",
    "country": "United Kingdom"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "id": "seller-uuid",
    "userId": "user-uuid",
    "email": "test-seller-123@example.com",
    "storeName": "Test Store",
    "slug": "test-store",
    "message": "Seller created successfully. They can now login and complete their profile through the onboarding flow."
  },
  "message": "Seller created successfully. They can now login and complete their profile through the onboarding flow."
}
```

#### 3. Test Seller Login

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-seller-123@example.com",
    "password": "TestPassword123"
  }'
```

**Expected:** Returns seller token and user data with role `B2C_SELLER`

#### 4. Check Seller Profile

```bash
curl -X GET "https://hos-marketplaceapi-production.up.railway.app/api/sellers/me" \
  -H "Authorization: Bearer SELLER_TOKEN"
```

**Expected:** Profile with `verified: false` (triggers onboarding)

#### 5. Frontend Test

1. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
2. Login with seller email and password
3. **Expected:** Redirects to `/seller/onboarding`
4. Complete onboarding steps
5. After completion, access `/seller/dashboard`

## Test Checklist

- [ ] Admin can login and get token
- [ ] Admin can create seller via API
- [ ] Seller creation returns correct data
- [ ] Seller can login with provided credentials
- [ ] Seller profile shows `verified: false`
- [ ] Frontend redirects seller to onboarding
- [ ] Onboarding flow works correctly
- [ ] After onboarding, seller can access dashboard

## Error Scenarios to Test

### 1. Duplicate Email
```bash
# Try creating seller with existing email
curl -X POST ".../api/admin/sellers/create" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"email":"existing@example.com","password":"test123"}'
```
**Expected:** `409 Conflict - User with this email already exists`

### 2. Missing Required Fields
```bash
# Try without email
curl -X POST ".../api/admin/sellers/create" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"password":"test123"}'
```
**Expected:** `400 Bad Request - Validation errors`

### 3. Unauthorized Access
```bash
# Try without admin token
curl -X POST ".../api/admin/sellers/create" \
  -d '{"email":"test@example.com","password":"test123"}'
```
**Expected:** `401 Unauthorized`

### 4. Non-Admin User
```bash
# Try with customer/seller token
curl -X POST ".../api/admin/sellers/create" \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -d '{"email":"test@example.com","password":"test123"}'
```
**Expected:** `403 Forbidden - Insufficient permissions`

## Success Criteria

✅ **All tests pass**
✅ **Seller created with minimal details**
✅ **Seller can login immediately**
✅ **Onboarding flow triggered automatically**
✅ **Seller can complete profile setup**
✅ **Error handling works correctly**

---

**Status:** Ready for testing

