# 👤 Create Super Admin on Railway

## Quick Method: Using Railway CLI or API

Since the database is on Railway, the easiest way is to run the script on Railway or use Prisma Studio.

---

## 🚀 Method 1: Run Script on Railway (Recommended)

### Option A: Using Railway CLI

1. **Install Railway CLI** (if not installed):
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   railway link
   ```

4. **Run the seed script**:
   ```bash
   cd services/api
   railway run pnpm db:seed-admin
   ```

### Option B: Using Railway One-Click Deploy

1. Go to Railway Dashboard
2. Select `@hos-marketplace/api` service
3. Go to **Deployments** tab
4. Click **"Deploy"** or **"Redeploy"**
5. The script can be run via Railway's console

---

## 🚀 Method 2: Using Prisma Studio (Easiest)

### Step 1: Open Prisma Studio on Railway

**Option A: Via Railway CLI**
```bash
cd services/api
railway run pnpm db:studio
```

**Option B: Via Railway Dashboard**
1. Railway Dashboard → `@hos-marketplace/api` service
2. Go to **Settings** → **Deploy**
3. Use Railway's console/terminal feature

### Step 2: Create Admin User

1. Prisma Studio opens in browser
2. Go to **User** model
3. Click **"Add record"** (+ button)
4. Fill in:
   - **email:** `app@houseofspells.co.uk`
   - **password:** (see hash below)
   - **role:** `ADMIN`
   - **firstName:** `Super`
   - **lastName:** `Admin`
   - **createdAt:** (auto)
   - **updatedAt:** (auto)

### Step 3: Get Password Hash

Run this to generate the hash:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin123', 10).then(hash => console.log(hash))"
```

Or use this pre-generated hash:
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

---

## 🚀 Method 3: Using API Registration Endpoint

If admin registration is allowed:

```bash
curl -X POST https://your-api-url.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "admin"
  }'
```

Then update the role to ADMIN via Prisma Studio or database.

---

## 🚀 Method 4: Direct SQL (Advanced)

If you have database access:

```sql
-- First, generate password hash using Node.js:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin123', 10).then(hash => console.log(hash))"

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

## ✅ Admin User Details

- **Email:** `app@houseofspells.co.uk`
- **Password:** `Admin123`
- **Role:** `ADMIN`
- **Name:** Super Admin

**Password Hash (bcrypt, 10 rounds):**
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

---

## 🔧 Verification

### Test Login

```bash
curl -X POST https://your-api-url.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "email": "app@houseofspells.co.uk",
    "role": "ADMIN",
    ...
  },
  "token": "...",
  "refreshToken": "..."
}
```

---

## 📝 Quick Reference

**Easiest Method:**
1. Use Railway CLI: `railway run pnpm db:seed-admin`
2. Or use Prisma Studio: `railway run pnpm db:studio`
3. Or use the pre-generated hash in SQL

**Password Hash for "Admin123":**
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

---

**Last Updated:** December 3, 2025

