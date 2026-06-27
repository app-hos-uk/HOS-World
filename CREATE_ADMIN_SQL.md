# 👤 Create Admin via Railway Database Console

## Problem
Prisma Studio can't connect to Railway's internal database URL from your local machine.

## ✅ Solution: Use Railway Database Console

### Step 1: Access Railway Database Console

1. Go to **Railway Dashboard**: https://railway.app
2. Select your **PostgreSQL** service (not the API service)
3. Go to the **Data** tab or **Query** tab
4. You'll see a SQL editor/console

### Step 2: Run This SQL

Copy and paste this SQL into the console:

```sql
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'app@houseofspells.co.uk',
  '[bcrypt-hash-redacted]',
  'Super',
  'Admin',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
  role = 'ADMIN',
  password = '[bcrypt-hash-redacted]';
```

### Step 3: Execute

Click **Run** or **Execute** button in the SQL console.

---

## ✅ Verify Admin Created

After running the SQL, verify with:

```sql
SELECT id, email, role, "firstName", "lastName" 
FROM users 
WHERE email = 'app@houseofspells.co.uk';
```

You should see:
- email: `app@houseofspells.co.uk`
- role: `ADMIN`
- firstName: `Super`
- lastName: `Admin`

---

## 🔑 Admin Credentials

- **Email:** `app@houseofspells.co.uk`
- **Password:** ``$SEED_ADMIN_PASSWORD` (env)`
- **Role:** `ADMIN`

---

## 📝 Alternative: Use Railway's Table Editor

If Railway has a table editor (not just SQL console):

1. Go to PostgreSQL service → **Data** tab
2. Find **users** table
3. Click **Add Row** or **New Record**
4. Fill in:
   - email: `app@houseofspells.co.uk`
   - password: `[bcrypt-hash-redacted]`
   - role: `ADMIN`
   - firstName: `Super`
   - lastName: `Admin`
5. Save

---

**This method works because it runs directly on Railway's infrastructure!**



