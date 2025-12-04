# 🔍 Admin User Verification - Alternative Methods

The Railway CLI verification script encountered a database connection issue. Here are alternative ways to check if the admin user exists:

---

## 🚀 Method 1: Railway Dashboard - SQL Query (Easiest)

### Steps:

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Select your project: **HOS-World Production Deployment**

2. **Open PostgreSQL Service**
   - Find the **PostgreSQL** service (not the API service)
   - Click on it

3. **Open Query Tab**
   - Click on **"Query"** or **"Data"** tab
   - You'll see a SQL editor

4. **Run This Query:**
   ```sql
   SELECT 
     id, 
     email, 
     role, 
     "firstName", 
     "lastName", 
     "createdAt", 
     "updatedAt"
   FROM users 
   WHERE email = 'app@houseofspells.co.uk';
   ```

5. **Check Results:**
   - **If user exists:** You'll see the admin user details
   - **If no results:** Admin user doesn't exist yet

---

## 🚀 Method 2: Test Login via API

### Steps:

1. **Get Your API URL**
   - Go to Railway Dashboard
   - Select `@hos-marketplace/api` service
   - Copy the public URL (e.g., `https://your-api.railway.app`)

2. **Test Login:**
   ```bash
   curl -X POST https://your-api-url.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "app@houseofspells.co.uk",
       "password": "Admin123"
     }'
   ```

3. **Check Response:**
   - **If admin exists and password is correct:**
     - Status: `200 OK`
     - Response includes: `"role": "ADMIN"`
     - You'll get a JWT token
   
   - **If admin doesn't exist:**
     - Status: `401 Unauthorized` or `404 Not Found`
     - Error message about invalid credentials

---

## 🚀 Method 3: Railway Dashboard - Table Editor

### Steps:

1. **Go to Railway Dashboard**
   - Select **PostgreSQL** service

2. **Open Data/Table View**
   - Click on **"Data"** or **"Tables"** tab
   - Find the **`users`** table
   - Click on it

3. **Search for Admin User**
   - Use the search/filter feature
   - Search for: `app@houseofspells.co.uk`
   - Check if the user exists and what role they have

---

## 🚀 Method 4: Fix Database Connection & Run Script

### If Database Connection Issue:

1. **Check Railway Environment Variables:**
   ```bash
   cd services/api
   railway variables
   ```
   - Verify `DATABASE_URL` is set
   - It should point to your PostgreSQL service

2. **Check Database Service Status:**
   - Go to Railway Dashboard
   - Check if PostgreSQL service is running
   - Restart if needed

3. **Try Running Script Again:**
   ```bash
   railway run pnpm db:verify-admin
   ```

---

## 🚀 Method 5: Create Admin User Directly (If Doesn't Exist)

If verification shows admin doesn't exist, create it:

### Option A: Using Railway CLI
```bash
cd services/api
railway run pnpm db:seed-admin
```

### Option B: Using Railway Dashboard SQL
1. Go to PostgreSQL service → Query tab
2. Run this SQL:
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

## 📋 Admin User Details

- **Email:** `app@houseofspells.co.uk`
- **Password:** `Admin123`
- **Role:** `ADMIN`
- **Name:** Super Admin
- **Password Hash:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

---

## ✅ Recommended Approach

**For Quick Check:**
1. Use **Method 1** (Railway Dashboard SQL Query) - Fastest and most reliable
2. Or **Method 2** (Test Login) - If you know your API URL

**If Admin Doesn't Exist:**
1. Use **Method 5 Option A** (Railway CLI script) - Easiest
2. Or **Method 5 Option B** (Direct SQL) - If script doesn't work

---

## 🔧 Troubleshooting Database Connection

If `railway run` can't connect to database:

1. **Check Railway Project Link:**
   ```bash
   railway status
   ```
   - Should show your project and service

2. **Check Environment Variables:**
   ```bash
   railway variables
   ```
   - Verify `DATABASE_URL` exists

3. **Check Database Service:**
   - Go to Railway Dashboard
   - Ensure PostgreSQL service is running
   - Check service logs for errors

4. **Try Different Service:**
   - Make sure you're running the command in the API service context
   - The database connection should use Railway's internal network

---

**Last Updated:** $(date)

