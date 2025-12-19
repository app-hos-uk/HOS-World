# Manual Seller Creation Test Guide

## Prerequisites
1. Admin account credentials
2. API URL: `https://hos-marketplaceapi-production.up.railway.app/api`
3. Admin authentication token

## Test Steps

### Step 1: Get Admin Token

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "YOUR_ADMIN_PASSWORD"
  }'
```

Save the `token` from the response.

### Step 2: Create Seller

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/admin/sellers/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "test-seller-123@example.com",
    "password": "TestPassword123",
    "storeName": "Test Store",
    "country": "United Kingdom"
  }'
```

### Step 3: Test Seller Login

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-seller-123@example.com",
    "password": "TestPassword123"
  }'
```

### Step 4: Check Seller Profile

```bash
curl -X GET "https://hos-marketplaceapi-production.up.railway.app/api/sellers/me" \
  -H "Authorization: Bearer SELLER_TOKEN"
```

## Expected Results

1. ✅ Admin login returns token
2. ✅ Seller creation returns seller details with `verified: false`
3. ✅ Seller can login with provided credentials
4. ✅ Seller profile shows `verified: false` (triggers onboarding)
5. ✅ Seller redirected to onboarding flow on frontend

## Frontend Testing

1. Go to: `https://hos-marketplaceweb-production.up.railway.app/login`
2. Login with seller email and password
3. Should redirect to `/seller/onboarding`
4. Complete onboarding steps
5. After completion, access `/seller/dashboard`
