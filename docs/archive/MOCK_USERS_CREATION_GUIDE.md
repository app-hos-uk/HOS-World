# 👥 Mock Users Creation Guide

## Quick Setup for RBAC Testing

### Option 1: Create Users via Registration API (Recommended)

You can create users via the registration endpoint. Here are the credentials for all roles:

**Password for all users: ``$TEST_SEED_PASSWORD` (env)`**

```bash
# Set your API URL
API_URL="https://hos-marketplaceapi-production.up.railway.app/api"
# Or for local: API_URL="http://localhost:3001/api"

# CUSTOMER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@hos.test",
    "password": "`$TEST_SEED_PASSWORD` (env)",
    "firstName": "John",
    "lastName": "Customer",
    "role": "customer"
  }'

# WHOLESALER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wholesaler@hos.test",
    "password": "`$TEST_SEED_PASSWORD` (env)",
    "firstName": "Sarah",
    "lastName": "Wholesaler",
    "role": "wholesaler",
    "storeName": "Wholesale Magic Supplies"
  }'

# B2C_SELLER
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@hos.test",
    "password": "`$TEST_SEED_PASSWORD` (env)",
    "firstName": "Mike",
    "lastName": "Seller",
    "role": "b2c_seller",
    "storeName": "B2C Magic Store"
  }'

# ADMIN (Note: Admin role might need to be set via database)
# Register as customer first, then update role in database

# PROCUREMENT (Need to create as customer, then update role)
# FULFILLMENT (Need to create as customer, then update role)
# CATALOG (Need to create as customer, then update role)
# MARKETING (Need to create as customer, then update role)
# FINANCE (Need to create as customer, then update role)
# CMS_EDITOR (Need to create as customer, then update role)
```

### Option 2: Use Prisma Studio (Visual)

1. **Open Prisma Studio:**
   ```bash
   cd services/api
   railway run pnpm db:studio
   # Or locally: pnpm db:studio
   ```

2. **Create users manually:**
   - Click on "User" model
   - Click "Add record"
   - Fill in details (see table below)
   - For password, use this hash: `[bcrypt-hash-redacted]` (for "`$TEST_SEED_PASSWORD` (env)")
   - Set role to uppercase (e.g., `ADMIN`, `CUSTOMER`, etc.)

### Option 3: SQL Direct Insert

If you have database access:

```sql
-- Password hash for "`$TEST_SEED_PASSWORD` (env)"
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'customer@hos.test', '[bcrypt-hash-redacted]', 'John', 'Customer', 'CUSTOMER', NOW(), NOW()),
  (gen_random_uuid(), 'admin@hos.test', '[bcrypt-hash-redacted]', 'Admin', 'User', 'ADMIN', NOW(), NOW()),
  (gen_random_uuid(), 'procurement@hos.test', '[bcrypt-hash-redacted]', 'Procurement', 'Manager', 'PROCUREMENT', NOW(), NOW()),
  (gen_random_uuid(), 'fulfillment@hos.test', '[bcrypt-hash-redacted]', 'Fulfillment', 'Staff', 'FULFILLMENT', NOW(), NOW()),
  (gen_random_uuid(), 'catalog@hos.test', '[bcrypt-hash-redacted]', 'Catalog', 'Editor', 'CATALOG', NOW(), NOW()),
  (gen_random_uuid(), 'marketing@hos.test', '[bcrypt-hash-redacted]', 'Marketing', 'Manager', 'MARKETING', NOW(), NOW()),
  (gen_random_uuid(), 'finance@hos.test', '[bcrypt-hash-redacted]', 'Finance', 'Manager', 'FINANCE', NOW(), NOW()),
  (gen_random_uuid(), 'cms@hos.test', '[bcrypt-hash-redacted]', 'CMS', 'Editor', 'CMS_EDITOR', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET 
  role = EXCLUDED.role,
  password = EXCLUDED.password;

-- For sellers, also create seller profiles
```

---

## 📋 Complete User List

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
| cms@hos.test | `$TEST_SEED_PASSWORD` (env) | CMS_EDITOR | `/` |

**Password Hash (for direct DB insert):**  
`[bcrypt-hash-redacted]`

---

## ⚠️ Important Notes

1. **Seller Roles** (WHOLESALER, B2C_SELLER) also need a `Seller` profile created
2. **CUSTOMER** role needs a `Customer` profile created
3. **Team Roles** (PROCUREMENT, FULFILLMENT, etc.) don't need special profiles
4. **ADMIN** role can be set directly on User model

---

## ✅ Verification

After creating users, verify they can login:

```bash
curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hos.test",
    "password": "`$TEST_SEED_PASSWORD` (env)"
  }'
```

Should return a JWT token and user data with correct role.

