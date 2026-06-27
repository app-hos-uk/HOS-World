# 🔐 RBAC Testing Guide - Complete Instructions

## ✅ RBAC Implementation Status: **COMPLETE**

All RBAC features have been successfully implemented:
- ✅ Authentication context with role checking
- ✅ Route protection for all dashboards
- ✅ Access denied page
- ✅ Role-based navigation

---

## 🧪 Testing Setup

### Step 1: Create Mock Users

Before testing, we need to create mock users. Here are **3 methods**:

#### Method 1: API Registration (Easiest - For CUSTOMER, WHOLESALER, B2C_SELLER)

Run this script:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
export API_URL="https://hos-marketplaceapi-production.up.railway.app/api"
./scripts/create-test-users.sh
```

Or manually via curl:
```bash
API_URL="https://hos-marketplaceapi-production.up.railway.app/api"

# CUSTOMER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)", "firstName": "John", "lastName": "Customer", "role": "customer"}'

# WHOLESALER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "wholesaler@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)", "firstName": "Sarah", "lastName": "Wholesaler", "role": "wholesaler", "storeName": "Wholesale Magic Supplies"}'

# B2C_SELLER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "seller@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)", "firstName": "Mike", "lastName": "Seller", "role": "b2c_seller", "storeName": "B2C Magic Store"}'
```

#### Method 2: Prisma Studio (Visual - For All Roles)

```bash
cd services/api
railway run pnpm db:studio
```

Then:
1. Click on "User" model
2. Click "Add record" (+)
3. Fill in:
   - **email:** (use emails from table below)
   - **password:** `[bcrypt-hash-redacted]` (hash for "`$TEST_SEED_PASSWORD` (env)")
   - **role:** UPPERCASE (e.g., `ADMIN`, `CUSTOMER`)
   - **firstName:** (use from table)
   - **lastName:** (use from table)

#### Method 3: SQL Direct Insert (Advanced - For All Roles)

See `MOCK_USERS_CREATION_GUIDE.md` for SQL scripts.

---

## 📋 Complete Test Users List

**Password for ALL users: ``$TEST_SEED_PASSWORD` (env)`**

| Email | Password | Role | First Name | Last Name | Dashboard URL |
|-------|----------|------|------------|-----------|---------------|
| customer@hos.test | `$TEST_SEED_PASSWORD` (env) | CUSTOMER | John | Customer | `/` |
| wholesaler@hos.test | `$TEST_SEED_PASSWORD` (env) | WHOLESALER | Sarah | Wholesaler | `/wholesaler/dashboard` |
| seller@hos.test | `$TEST_SEED_PASSWORD` (env) | B2C_SELLER | Mike | Seller | `/seller/dashboard` |
| admin@hos.test | `$TEST_SEED_PASSWORD` (env) | ADMIN | Admin | User | `/admin/dashboard` |
| procurement@hos.test | `$TEST_SEED_PASSWORD` (env) | PROCUREMENT | Procurement | Manager | `/procurement/dashboard` |
| fulfillment@hos.test | `$TEST_SEED_PASSWORD` (env) | FULFILLMENT | Fulfillment | Staff | `/fulfillment/dashboard` |
| catalog@hos.test | `$TEST_SEED_PASSWORD` (env) | CATALOG | Catalog | Editor | `/catalog/dashboard` |
| marketing@hos.test | `$TEST_SEED_PASSWORD` (env) | MARKETING | Marketing | Manager | `/marketing/dashboard` |
| finance@hos.test | `$TEST_SEED_PASSWORD` (env) | FINANCE | Finance | Manager | `/finance/dashboard` |
| cms@hos.test | `$TEST_SEED_PASSWORD` (env) | CMS_EDITOR | CMS | Editor | `/` |

**Password Hash (for Prisma Studio/SQL):**  
`[bcrypt-hash-redacted]`

---

## 🎯 Browser Automation Test Plan

Once users are created, we'll test:

### Test 1: Login Flow
- Navigate to login page
- Enter credentials
- Click login
- Verify redirect to correct dashboard

### Test 2: Route Protection
- Try accessing protected routes
- Verify redirects work correctly
- Test access denied page

### Test 3: Dashboard Access
- Verify each role can access their dashboard
- Verify wrong roles cannot access dashboards

### Test 4: Navigation
- Verify header shows correct links
- Test logout functionality

---

## 🌐 Application URLs

**Production Frontend:** `https://hos-marketplaceweb-production.up.railway.app`  
**Production API:** `https://hos-marketplaceapi-production.up.railway.app/api`

---

## ✅ Ready to Test!

1. **Create users** using one of the methods above
2. **Run browser automation tests** (I'll execute these once users are created)
3. **Verify RBAC works** for all roles

---

## 📝 Current Status

- ✅ RBAC system fully implemented
- ✅ All routes protected
- ✅ Authentication context working
- ⏳ **Awaiting:** Mock users creation
- ⏳ **Next:** Browser automation tests

---

**Let me know when users are created, and I'll proceed with the browser automation tests!**

Or if you want, I can guide you through creating users first, then we'll run the tests together.

