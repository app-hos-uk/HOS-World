# 🔧 Fix: Create Admin on Railway

## Problem

The script is trying to connect to `postgres.railway.internal:5432`, which is only accessible from within Railway's network, not from your local machine.

## ✅ Solution: Use Railway Database Proxy

### Method 1: Use Railway Connect (Recommended)

Railway CLI can proxy the database connection. Try this:

```bash
cd services/api

# Connect to Railway database
railway connect postgres

# In a NEW terminal window, run the seed script
railway run pnpm db:seed-admin
```

### Method 2: Use Public DATABASE_URL

1. **Get the public DATABASE_URL from Railway:**
   ```bash
   railway variables
   ```
   
2. **Look for DATABASE_URL** - it should have a public hostname, not `postgres.railway.internal`

3. **If it's internal, update it:**
   - Go to Railway Dashboard
   - PostgreSQL service → Variables
   - Copy the **public** DATABASE_URL (starts with `postgresql://` with a public hostname)
   - Update the `@hos-marketplace/api` service's DATABASE_URL variable

### Method 3: Use Prisma Studio (Easiest)

Prisma Studio can work through Railway's proxy:

```bash
cd services/api

# This will tunnel the database connection
railway run pnpm db:studio
```

Then in Prisma Studio:
1. Click **User** model
2. Click **"Add record"** (+)
3. Fill in:
   - **email:** `app@houseofspells.co.uk`
   - **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
   - **role:** `ADMIN`
   - **firstName:** `Super`
   - **lastName:** `Admin`
4. Click **Save**

### Method 4: Direct SQL via Railway Dashboard

1. Go to Railway Dashboard
2. Select **PostgreSQL** service
3. Go to **Data** or **Query** tab
4. Run this SQL:

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
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
```

---

## 🔍 Check Current DATABASE_URL

```bash
railway variables | grep DATABASE_URL
```

If it shows `postgres.railway.internal`, you need to:
1. Get the public URL from PostgreSQL service
2. Update the API service's DATABASE_URL variable

---

## ✅ Recommended: Use Prisma Studio

This is the easiest method that works with Railway's internal URLs:

```bash
cd services/api
railway run pnpm db:studio
```

Then create the user manually in the browser interface.

