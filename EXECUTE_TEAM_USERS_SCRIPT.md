# 🚀 Execute Team Users Script - Quick Guide

## ✅ Script Ready: `scripts/create-team-role-users.sql`

The SQL script is ready to execute. Since the database is on Railway and uses an internal network URL, here are the best ways to execute it:

---

## 🎯 Method 1: Railway Database Query Interface (Easiest)

### Step 1: Access Railway Database

1. Go to **Railway Dashboard**
2. Click on your **PostgreSQL** service
3. Go to **"Data"** or **"Query"** tab
4. You'll see a SQL query interface

### Step 2: Execute SQL Script

1. Open the file: `scripts/create-team-role-users.sql`
2. **Copy the entire contents** of the file
3. **Paste into the Railway SQL query interface**
4. Click **"Run Query"** or **"Execute"**

**That's it!** All 7 team role users will be created.

---

## 🎯 Method 2: Railway CLI with Database Connection

If you have Railway CLI and can connect to the database:

```bash
# Make sure you're linked to the Railway project
cd services/api
railway link

# Connect to database
railway connect postgres

# In a NEW terminal, run:
cd services/api
cat ../scripts/create-team-role-users.sql | railway run psql
```

---

## 🎯 Method 3: Prisma Studio (Visual)

### Step 1: Open Prisma Studio on Railway

```bash
cd services/api
railway run pnpm db:studio
```

Prisma Studio will open in your browser.

### Step 2: Create Users Manually

For each user:

1. Click **"User"** model
2. Click **"Add record"** (+)
3. Fill in:
   - **email:** (from table below)
   - **password:** `[bcrypt-hash-redacted]`
   - **firstName:** (from table)
   - **lastName:** (from table)
   - **role:** UPPERCASE (e.g., `ADMIN`)
4. Click **"Save"**

---

## 📋 Users to Create

| Email | Role | First Name | Last Name | Password Hash |
|-------|------|------------|-----------|---------------|
| admin@hos.test | ADMIN | Admin | User | `[bcrypt-hash-redacted]` |
| procurement@hos.test | PROCUREMENT | Procurement | Manager | Same hash |
| fulfillment@hos.test | FULFILLMENT | Fulfillment | Staff | Same hash |
| catalog@hos.test | CATALOG | Catalog | Editor | Same hash |
| marketing@hos.test | MARKETING | Marketing | Manager | Same hash |
| finance@hos.test | FINANCE | Finance | Manager | Same hash |
| cms@hos.test | CMS_EDITOR | CMS | Editor | Same hash |

**Password for all:** ``$TEST_SEED_PASSWORD` (env)`

---

## ✅ Verification

After creating users, verify they exist:

**Via SQL Query (in Railway Database interface):**
```sql
SELECT email, role, "firstName", "lastName", "createdAt"
FROM users
WHERE email LIKE '%@hos.test'
ORDER BY role;
```

**Or test login via API:**
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@hos.test", "password": "`$TEST_SEED_PASSWORD` (env)"}'
```

Should return a JWT token with `"role": "ADMIN"`.

---

## 🎯 Recommended: Use Method 1

**Just copy-paste the SQL script into Railway's database query interface!**

1. Railway Dashboard → PostgreSQL → Data/Query tab
2. Copy contents of `scripts/create-team-role-users.sql`
3. Paste and execute
4. Done! ✅

---

**The script file is ready at:** `scripts/create-team-role-users.sql`

