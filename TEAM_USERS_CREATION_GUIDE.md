# 👥 Team Role Users Creation Guide

## Quick Setup Instructions

All team role users need to be created manually since they cannot be registered via API.

---

## ✅ Already Created (3 users)

- ✅ `customer@hos.test` - CUSTOMER
- ✅ `wholesaler@hos.test` - WHOLESALER  
- ✅ `seller@hos.test` - B2C_SELLER

**Password:** `Test123!`

---

## 📋 Need to Create (7 users)

| Email | Role | First Name | Last Name |
|-------|------|------------|-----------|
| admin@hos.test | ADMIN | Admin | User |
| procurement@hos.test | PROCUREMENT | Procurement | Manager |
| fulfillment@hos.test | FULFILLMENT | Fulfillment | Staff |
| catalog@hos.test | CATALOG | Catalog | Editor |
| marketing@hos.test | MARKETING | Marketing | Manager |
| finance@hos.test | FINANCE | Finance | Manager |
| cms@hos.test | CMS_EDITOR | CMS | Editor |

**Password for all:** `Test123!`  
**Password Hash:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

---

## 🚀 Method 1: SQL Script (Recommended - Fastest)

### Step 1: Access Database

**Option A: Railway CLI**
```bash
cd services/api
railway run psql
```

**Option B: Railway Dashboard**
1. Go to Railway Dashboard
2. Select PostgreSQL service
3. Go to "Data" or "Query" tab
4. Open SQL query interface

### Step 2: Execute SQL Script

Copy and paste the contents of `scripts/create-team-role-users.sql` into the SQL interface and execute.

Or run directly:
```bash
cd services/api
railway run psql < ../scripts/create-team-role-users.sql
```

**That's it!** All 7 users will be created.

---

## 🚀 Method 2: Prisma Studio (Visual Interface)

### Step 1: Open Prisma Studio

```bash
cd services/api
railway run pnpm db:studio
```

Prisma Studio will open in your browser.

### Step 2: Create Each User

For each user in the table above:

1. Click on **"User"** model in the left sidebar
2. Click **"Add record"** button (+)
3. Fill in the form:
   - **id:** Leave empty (auto-generated)
   - **email:** (use from table)
   - **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
   - **firstName:** (use from table)
   - **lastName:** (use from table)
   - **role:** Select from dropdown (UPPERCASE, e.g., `ADMIN`)
   - **avatar:** Leave empty (optional)
   - **characterAvatar:** Leave empty (optional)
   - **createdAt:** Leave empty (auto-generated)
   - **updatedAt:** Leave empty (auto-generated)
4. Click **"Save 1 change"**

Repeat for all 7 users.

---

## ✅ Verification

After creating users, verify they exist:

```sql
SELECT email, role, "firstName", "lastName"
FROM users
WHERE email LIKE '%@hos.test'
ORDER BY role;
```

Or test login via API:
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@hos.test", "password": "Test123!"}'
```

Should return a JWT token and user data with correct role.

---

## 📝 Quick Reference

**SQL Script Location:** `scripts/create-team-role-users.sql`

**Password Hash (for manual creation):**  
`$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

**All roles must be UPPERCASE:**
- `ADMIN` (not `admin`)
- `PROCUREMENT` (not `procurement`)
- etc.

---

**Once all users are created, you can test all dashboards with browser automation!**

