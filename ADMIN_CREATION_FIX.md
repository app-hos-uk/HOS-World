# 🔧 Fix: Admin User Creation Error

## ❌ Error Explanation

**Error:** `Can't reach database server at postgres.railway.internal:5432`

**Why it happens:**
- `postgres.railway.internal:5432` is Railway's **internal network address**
- This address is **only accessible from within Railway's infrastructure**
- When running scripts locally (even with `railway run`), you're still on your local machine
- The internal network isn't accessible from outside Railway

---

## ✅ Solution 1: Use Railway Dashboard SQL (EASIEST & MOST RELIABLE)

### Steps:

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Login to your account
   - Select project: **HOS-World Production Deployment**

2. **Open PostgreSQL Service**
   - Find the **PostgreSQL** service (not the API service)
   - Click on it

3. **Open Query Tab**
   - Click on **"Query"** or **"Data"** tab
   - You'll see a SQL editor

4. **Run This SQL to Create Admin:**
   ```sql
   INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
   VALUES (
     gen_random_uuid(),
     'app@houseofspells.co.uk',
     '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
     'Super',
     'Admin',
     'ADMIN',
     NOW(),
     NOW()
   )
   ON CONFLICT (email) 
   DO UPDATE SET 
     role = 'ADMIN',
     password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
     "updatedAt" = NOW();
   ```

5. **Verify Admin Created:**
   ```sql
   SELECT id, email, role, "firstName", "lastName", "createdAt", "updatedAt"
   FROM users 
   WHERE email = 'app@houseofspells.co.uk';
   ```

**This method works because it runs directly on Railway's database server!**

---

## ✅ Solution 2: Use Railway Service Console

### Steps:

1. **Go to Railway Dashboard**
   - Select your **API service** (`@hos-marketplace/api`)

2. **Open Service Console**
   - Click on **"Deployments"** tab
   - Find the latest deployment
   - Click **"View Logs"** or **"Console"**

3. **Run Script in Console**
   - Railway's console runs **inside** Railway's infrastructure
   - Execute: `pnpm db:seed-admin`
   - This will have access to the internal network

---

## ✅ Solution 3: Test via API Login (Check if Admin Exists)

Before creating, check if admin already exists:

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }'
```

**If you get:**
- ✅ **200 OK** with token → Admin exists and works!
- ❌ **401/404** → Admin doesn't exist, need to create it

---

## ✅ Solution 4: Use Railway CLI with Service Shell

### Steps:

1. **Open Railway Service Shell:**
   ```bash
   cd services/api
   railway shell
   ```

2. **Once in Railway shell, run:**
   ```bash
   pnpm db:seed-admin
   ```

   **Note:** `railway shell` gives you an interactive shell **inside** Railway's environment where internal network addresses work.

---

## 🔍 Why `railway run` Might Not Work

Even though `railway run` is supposed to execute in Railway's environment, it sometimes:
- Still runs locally but with Railway's environment variables
- Doesn't have access to Railway's internal network
- May have network routing issues

**The most reliable methods are:**
1. Railway Dashboard SQL (Solution 1) - **BEST**
2. Railway Service Console (Solution 2)
3. Railway Shell (Solution 4)

---

## 📋 Admin User Details

- **Email:** `app@houseofspells.co.uk`
- **Password:** `Admin123`
- **Role:** `ADMIN`
- **Name:** Super Admin
- **Password Hash:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

---

## 🎯 Recommended Action

**Use Solution 1 (Railway Dashboard SQL)** - It's the most reliable and straightforward:

1. Go to Railway Dashboard
2. Open PostgreSQL service → Query tab
3. Run the SQL INSERT statement above
4. Verify with the SELECT query

This bypasses all network issues because you're executing SQL directly on the database server!

---

## ✅ After Creating Admin

1. **Test Login:**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
   ```

2. **Change Password:**
   - Login via frontend or API
   - Change password from `Admin123` to a strong password
   - This is important for security!

---

**Last Updated:** $(date)

