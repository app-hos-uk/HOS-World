# 🔧 Fix Admin User - Make It Functional

## Current Status
✅ Admin user exists in database: `app@houseofspells.co.uk`  
❌ User is not functional (login returns 401)

## Problem
The user exists but likely has:
- ❌ Missing or incorrect `role` field (should be `ADMIN`)
- ❌ Incorrect password hash
- ❌ Missing required fields (`createdAt`, `updatedAt`)

---

## ✅ Solution: Update User via Railway Dashboard SQL

### Step 1: Go to Railway Dashboard
1. Visit: https://railway.app
2. Select project: **HOS-World Production Deployment**
3. Open **PostgreSQL** service
4. Click **"Query"** or **"Data"** tab

### Step 2: Run This SQL to Fix the User

```sql
-- First, check current user status
SELECT id, email, role, "firstName", "lastName", "createdAt", "updatedAt"
FROM users 
WHERE email = 'app@houseofspells.co.uk';

-- Update user to make it functional
UPDATE users
SET 
  role = 'ADMIN',
  password = '[bcrypt-hash-redacted]',
  "firstName" = COALESCE("firstName", 'Super'),
  "lastName" = COALESCE("lastName", 'Admin'),
  "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';

-- Verify the update
SELECT id, email, role, "firstName", "lastName", "createdAt", "updatedAt"
FROM users 
WHERE email = 'app@houseofspells.co.uk';
```

### What This Does:
- ✅ Sets `role` to `ADMIN` (required for admin access)
- ✅ Sets correct password hash for ``$SEED_ADMIN_PASSWORD` (env)`
- ✅ Sets `firstName` to `Super` if missing
- ✅ Sets `lastName` to `Admin` if missing
- ✅ Updates `updatedAt` timestamp

---

## ✅ Alternative: Complete User Update (If Missing Fields)

If the user is missing `createdAt` or other fields:

```sql
UPDATE users
SET 
  role = 'ADMIN',
  password = '[bcrypt-hash-redacted]',
  "firstName" = COALESCE("firstName", 'Super'),
  "lastName" = COALESCE("lastName", 'Admin'),
  "createdAt" = COALESCE("createdAt", NOW()),
  "updatedAt" = NOW(),
  "loyaltyPoints" = COALESCE("loyaltyPoints", 0)
WHERE email = 'app@houseofspells.co.uk';
```

---

## ✅ Verify Admin is Functional

### Test 1: Check Database
```sql
SELECT id, email, role, "firstName", "lastName"
FROM users 
WHERE email = 'app@houseofspells.co.uk';
```

**Expected Result:**
- `role` should be `ADMIN`
- `email` should be `app@houseofspells.co.uk`
- `firstName` should be `Super`
- `lastName` should be `Admin`

### Test 2: Test Login via API
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "`$SEED_ADMIN_PASSWORD` (env)"
  }'
```

**Expected Result:**
- Status: `200 OK`
- Response includes: `"role": "ADMIN"`
- You'll get a JWT token

---

## 📋 Admin User Details

- **Email:** `app@houseofspells.co.uk`
- **Password:** ``$SEED_ADMIN_PASSWORD` (env)`
- **Role:** `ADMIN` (must be exactly this)
- **Name:** Super Admin
- **Password Hash:** `[bcrypt-hash-redacted]`

---

## 🔍 Common Issues & Fixes

### Issue 1: Role is NULL or CUSTOMER
**Fix:** Run the UPDATE SQL above to set `role = 'ADMIN'`

### Issue 2: Password Hash is Wrong
**Fix:** The UPDATE SQL sets the correct hash for ``$SEED_ADMIN_PASSWORD` (env)`

### Issue 3: Missing Timestamps
**Fix:** The UPDATE SQL sets `updatedAt = NOW()` and uses `COALESCE` for `createdAt`

### Issue 4: Still Getting 401 After Update
**Check:**
1. Verify role is exactly `ADMIN` (case-sensitive, all caps)
2. Verify password hash matches exactly
3. Check API logs for authentication errors
4. Try logging in again after a few seconds (cache might need to clear)

---

## 🎯 Quick Fix Command

Copy and paste this into Railway's SQL Query tab:

```sql
UPDATE users
SET 
  role = 'ADMIN',
  password = '[bcrypt-hash-redacted]',
  "firstName" = COALESCE("firstName", 'Super'),
  "lastName" = COALESCE("lastName", 'Admin'),
  "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';
```

Then verify:
```sql
SELECT email, role, "firstName", "lastName" FROM users WHERE email = 'app@houseofspells.co.uk';
```

---

**After running the SQL, test login to confirm the admin user is functional!**

