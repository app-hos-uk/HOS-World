# 👤 Create Super Admin - Quick Guide

## Admin User Details

- **Email:** `app@houseofspells.co.uk`
- **Password:** `Admin123`
- **Role:** `ADMIN`

---

## 🚀 Easiest Method: Using Railway CLI

### Step 1: Install Railway CLI (if needed)
```bash
npm i -g @railway/cli
```

### Step 2: Login and Link
```bash
railway login
cd services/api
railway link
```

### Step 3: Run Script
```bash
railway run pnpm db:seed-admin
```

**That's it!** The admin user will be created.

---

## 🚀 Alternative: Using Prisma Studio

### Step 1: Open Prisma Studio on Railway
```bash
cd services/api
railway run pnpm db:studio
```

### Step 2: Create User
1. Prisma Studio opens in browser
2. Click **User** model
3. Click **"Add record"** (+)
4. Fill in:
   - **email:** `app@houseofspells.co.uk`
   - **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
   - **role:** `ADMIN`
   - **firstName:** `Super`
   - **lastName:** `Admin`
5. Click **Save**

---

## 🚀 Alternative: Direct SQL

If you have database access via Railway:

1. Go to Railway Dashboard → PostgreSQL service
2. Open **Query** or **Connect** tab
3. Run this SQL:

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

## ✅ Verify Admin Created

**Test Login:**
```bash
curl -X POST https://your-api-url.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }'
```

**Expected:**
- Status: `200 OK`
- Response includes `"role": "ADMIN"`

---

## 📝 Password Hash

**Password:** `Admin123`  
**Hash:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

This hash is pre-generated and ready to use.

---

**Recommended:** Use Railway CLI method - it's the easiest!

