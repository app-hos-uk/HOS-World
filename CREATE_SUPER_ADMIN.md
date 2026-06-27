# 👤 Create Super Admin User

## Overview

This guide will help you create a super admin user with:
- **Email:** `app@houseofspells.co.uk`
- **Password:** ``$SEED_ADMIN_PASSWORD` (env)`
- **Role:** `ADMIN`

---

## 🚀 Method 1: Using Seed Script (Recommended)

### Step 1: Run the Seed Script

From the `services/api` directory:

```bash
cd services/api
pnpm db:seed-admin
```

Or using npm:
```bash
npm run db:seed-admin
```

### What It Does:
- ✅ Checks if user already exists
- ✅ Creates admin user if doesn't exist
- ✅ Updates existing user to ADMIN if needed
- ✅ Hashes password securely
- ✅ Sets role to ADMIN

---

## 🚀 Method 2: Using Prisma Studio (Visual)

### Step 1: Open Prisma Studio

```bash
cd services/api
pnpm db:studio
```

### Step 2: Create User Manually
1. Prisma Studio will open in browser
2. Go to **User** model
3. Click **"Add record"**
4. Fill in:
   - **email:** `app@houseofspells.co.uk`
   - **password:** (hash it first - see below)
   - **role:** `ADMIN`
   - **firstName:** `Super`
   - **lastName:** `Admin`

### Step 3: Hash Password

You need to hash the password first. Run this in Node.js:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('`$SEED_ADMIN_PASSWORD` (env)', 10).then(hash => console.log(hash))"
```

Copy the hashed password and use it in Prisma Studio.

---

## 🚀 Method 3: Using API Endpoint (If Available)

If you have an admin registration endpoint:

```bash
curl -X POST https://your-api-url.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "`$SEED_ADMIN_PASSWORD` (env)",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "admin"
  }'
```

**Note:** This may not work if admin registration is restricted.

---

## 🚀 Method 4: Direct Database (Advanced)

### Using psql or Database Client:

```sql
-- Hash password first (use bcrypt with salt rounds 10)
-- Password: `$SEED_ADMIN_PASSWORD` (env)
-- You'll need to generate the hash using Node.js or bcrypt tool

INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'app@houseofspells.co.uk',
  '$2b$10$YOUR_HASHED_PASSWORD_HERE', -- Generate this first
  'Super',
  'Admin',
  'ADMIN',
  NOW(),
  NOW()
);
```

---

## ✅ Verification

### Check User Was Created

**Using Prisma Studio:**
```bash
cd services/api
pnpm db:studio
```
- Go to User model
- Search for `app@houseofspells.co.uk`
- Verify role is `ADMIN`

**Using API:**
```bash
# Login to verify
curl -X POST https://your-api-url.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "`$SEED_ADMIN_PASSWORD` (env)"
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

## 🔧 Troubleshooting

### Issue: "User already exists"

**Solution:**
- The script will update the existing user to ADMIN
- Or manually update the role in Prisma Studio

### Issue: "Password hash error"

**Solution:**
- Ensure bcrypt is installed: `pnpm add bcrypt`
- Check Node.js version (needs 18+)

### Issue: "Cannot connect to database"

**Solution:**
- Verify `DATABASE_URL` is set correctly
- Check database is running
- Verify connection string format

---

## 📝 Admin User Details

- **Email:** `app@houseofspells.co.uk`
- **Password:** ``$SEED_ADMIN_PASSWORD` (env)`
- **Role:** `ADMIN`
- **Name:** Super Admin

**⚠️ Security Note:**
- Change password after first login
- Use strong password in production
- Enable 2FA if available

---

## 🎯 Quick Command

**Easiest Method:**
```bash
cd services/api
pnpm db:seed-admin
```

This will create or update the admin user automatically.

---

**Last Updated:** December 3, 2025

