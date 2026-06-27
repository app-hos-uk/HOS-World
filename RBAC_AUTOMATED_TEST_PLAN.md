# 🔐 RBAC Automated Test Plan

## Overview

This document outlines the automated testing plan for the RBAC (Role-Based Access Control) system using browser automation.

---

## 📋 Test Users Created

All test users have password: **``$TEST_SEED_PASSWORD` (env)`**

| Role | Email | Dashboard URL |
|------|-------|---------------|
| CUSTOMER | customer@hos.test | `/` (Home) |
| WHOLESALER | wholesaler@hos.test | `/wholesaler/dashboard` |
| B2C_SELLER | seller@hos.test | `/seller/dashboard` |
| ADMIN | admin@hos.test | `/admin/dashboard` |
| PROCUREMENT | procurement@hos.test | `/procurement/dashboard` |
| FULFILLMENT | fulfillment@hos.test | `/fulfillment/dashboard` |
| CATALOG | catalog@hos.test | `/catalog/dashboard` |
| MARKETING | marketing@hos.test | `/marketing/dashboard` |
| FINANCE | finance@hos.test | `/finance/dashboard` |
| CMS_EDITOR | cms@hos.test | `/` (Home) |

---

## 🚀 Step 1: Seed Mock Users

### Option A: Local Development

```bash
cd services/api
pnpm db:seed-all-roles
```

### Option B: Railway Production

```bash
cd services/api
railway run pnpm db:seed-all-roles
```

**Note:** This will create/update all test users in the database.

---

## 🧪 Step 2: Automated Browser Tests

### Test Scenarios

#### 1. Test Login & Redirect Flow
- ✅ Login with each role
- ✅ Verify redirect to correct dashboard
- ✅ Verify header shows correct user email
- ✅ Verify dashboard link in header

#### 2. Test Route Protection
- ✅ Try accessing protected routes without login (should redirect to login)
- ✅ Try accessing wrong dashboard (should redirect or show access denied)
- ✅ Verify access denied page works

#### 3. Test Dashboard Access
- ✅ Admin can access `/admin/dashboard`
- ✅ Seller can access `/seller/dashboard`
- ✅ Wholesaler can access `/wholesaler/dashboard`
- ✅ Each team role can access their respective dashboard
- ✅ Customer cannot access any dashboard (goes to home)

#### 4. Test Navigation
- ✅ Header shows dashboard link for authenticated users
- ✅ Logout works correctly
- ✅ After logout, cannot access protected routes

---

## 📝 Test Execution Plan

We'll test in this order:

1. **CUSTOMER** - Basic access
2. **ADMIN** - Full access
3. **WHOLESALER** - Seller dashboard
4. **B2C_SELLER** - Seller dashboard
5. **PROCUREMENT** - Team dashboard
6. **FULFILLMENT** - Team dashboard
7. **CATALOG** - Team dashboard
8. **MARKETING** - Team dashboard
9. **FINANCE** - Team dashboard

---

## ✅ Expected Results

### Successful Login
- Redirects to role-specific dashboard
- Header shows user email
- Dashboard link visible in header

### Route Protection
- Unauthenticated users → `/login`
- Wrong role → Access denied or redirect to their dashboard
- Correct role → Dashboard loads

### Access Denied
- Shows user role and email
- Provides redirect options
- Logout button works

---

## 🎯 Testing URLs

**Production:** `https://hos-marketplaceweb-production.up.railway.app`  
**Local:** `http://localhost:3000`

---

## 📊 Test Report Format

For each test:
- ✅ Pass / ❌ Fail
- Screenshot (if available)
- Error message (if failed)
- Timestamp

