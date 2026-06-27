# 🔐 RBAC Browser Automation Test Execution

## 🎯 Test Overview

This document provides step-by-step browser automation tests for the RBAC system. We'll test login, route protection, and dashboard access for all user roles.

---

## 📋 Prerequisites

### 1. Create Mock Users First

Before running browser tests, create mock users using one of these methods:

**Option A: Use Registration API**
```bash
API_URL="https://hos-marketplaceapi-production.up.railway.app/api"

# Create CUSTOMER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)", "firstName": "John", "lastName": "Customer", "role": "customer"}'

# Create WHOLESALER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "wholesaler@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)", "firstName": "Sarah", "lastName": "Wholesaler", "role": "wholesaler", "storeName": "Wholesale Magic Supplies"}'

# Create B2C_SELLER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "seller@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)", "firstName": "Mike", "lastName": "Seller", "role": "b2c_seller", "storeName": "B2C Magic Store"}'
```

**Option B: Use Prisma Studio**
1. Run: `cd services/api && railway run pnpm db:studio`
2. Create users manually with password hash: `[bcrypt-hash-redacted]`

**Option C: SQL Direct Insert** (see MOCK_USERS_CREATION_GUIDE.md)

### 2. Test Users Created

| Email | Password | Role | Dashboard |
|-------|----------|------|-----------|
| customer@hos.test | `$TEST_SEED_PASSWORD` (env) | CUSTOMER | `/` |
| wholesaler@hos.test | `$TEST_SEED_PASSWORD` (env) | WHOLESALER | `/wholesaler/dashboard` |
| seller@hos.test | `$TEST_SEED_PASSWORD` (env) | B2C_SELLER | `/seller/dashboard` |
| admin@hos.test | `$TEST_SEED_PASSWORD` (env) | ADMIN | `/admin/dashboard` |
| procurement@hos.test | `$TEST_SEED_PASSWORD` (env) | PROCUREMENT | `/procurement/dashboard` |
| fulfillment@hos.test | `$TEST_SEED_PASSWORD` (env) | FULFILLMENT | `/fulfillment/dashboard` |
| catalog@hos.test | `$TEST_SEED_PASSWORD` (env) | CATALOG | `/catalog/dashboard` |
| marketing@hos.test | `$TEST_SEED_PASSWORD` (env) | MARKETING | `/marketing/dashboard` |
| finance@hos.test | `$TEST_SEED_PASSWORD` (env) | FINANCE | `/finance/dashboard` |

---

## 🧪 Test Execution Plan

### Test 1: CUSTOMER Role

**Steps:**
1. Navigate to `/login`
2. Enter email: `customer@hos.test`
3. Enter password: ``$TEST_SEED_PASSWORD` (env)`
4. Click Login
5. **Expected:** Redirect to `/` (home page)
6. **Verify:** Header shows email and "Dashboard" link
7. **Verify:** Clicking dashboard link goes to home (CUSTOMER has no dashboard)

**Route Protection Test:**
- Try accessing `/admin/dashboard` → Should redirect or show access denied

---

### Test 2: ADMIN Role

**Steps:**
1. Logout (if logged in)
2. Navigate to `/login`
3. Enter email: `admin@hos.test`
4. Enter password: ``$TEST_SEED_PASSWORD` (env)`
5. Click Login
6. **Expected:** Redirect to `/admin/dashboard`
7. **Verify:** Dashboard loads with admin content
8. **Verify:** Header shows email and "Dashboard" link

**Route Protection Test:**
- Access `/admin/dashboard` → ✅ Allowed
- Access `/seller/dashboard` → ❌ Should redirect or access denied

---

### Test 3: WHOLESALER Role

**Steps:**
1. Logout
2. Login as `wholesaler@hos.test`
3. **Expected:** Redirect to `/wholesaler/dashboard`
4. **Verify:** Dashboard loads with wholesaler content

---

### Test 4: B2C_SELLER Role

**Steps:**
1. Logout
2. Login as `seller@hos.test`
3. **Expected:** Redirect to `/seller/dashboard`
4. **Verify:** Dashboard loads with seller content

---

### Test 5-9: Team Roles

Test each team role:
- PROCUREMENT → `/procurement/dashboard`
- FULFILLMENT → `/fulfillment/dashboard`
- CATALOG → `/catalog/dashboard`
- MARKETING → `/marketing/dashboard`
- FINANCE → `/finance/dashboard`

---

## 🔍 What We're Testing

1. ✅ **Login redirects** - Users go to correct dashboard after login
2. ✅ **Route protection** - Protected routes require authentication
3. ✅ **Role-based access** - Users can only access their dashboard
4. ✅ **Access denied page** - Wrong role shows proper error
5. ✅ **Header navigation** - Shows correct dashboard link
6. ✅ **Logout functionality** - Logout clears session and redirects

---

## 📊 Expected Results Summary

| Test | Expected Result | Status |
|------|----------------|--------|
| Customer Login | Redirects to `/` | ⏳ Pending |
| Admin Login | Redirects to `/admin/dashboard` | ⏳ Pending |
| Wholesaler Login | Redirects to `/wholesaler/dashboard` | ⏳ Pending |
| Seller Login | Redirects to `/seller/dashboard` | ⏳ Pending |
| Route Protection | Unauthenticated → `/login` | ⏳ Pending |
| Access Denied | Wrong role → Access denied page | ⏳ Pending |

---

## 🚀 Ready to Execute

Once mock users are created, we'll execute these tests using browser automation and document the results.

**Next Step:** Create mock users, then we'll run the browser automation tests!

