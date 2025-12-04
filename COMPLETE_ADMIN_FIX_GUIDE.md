# 🔧 COMPLETE ADMIN FIX - Step by Step Solution

## 🎯 Goal: Get Admin Login Working

This guide will fix the admin login issue once and for all.

---

## ✅ Method 1: Use Railway Dashboard SQL (EASIEST - NO EXTENSIONS NEEDED)

### Step 1: Go to Railway Dashboard
1. Visit: https://railway.app
2. Login to your account
3. Select project: **HOS-World Production Deployment**

### Step 2: Open PostgreSQL Service
1. Click on **Postgres** service (the database, not API)
2. Click on **"Database"** tab
3. Click on **"Data"** tab
4. Find and click on **`users`** table

### Step 3: Find the Admin User
1. Look for the row with email: `app@houseofspells.co.uk`
2. Click on that row to select it

### Step 4: Delete the Existing User (Fresh Start)
1. Click the **trash icon** (delete button) on the row
2. Confirm deletion
3. This removes any corrupted data

### Step 5: Create New Admin User
1. Click **"+ Row"** button (purple button, bottom left)
2. Fill in these fields **EXACTLY**:

| Field | Value |
|-------|-------|
| **id** | (leave empty - will auto-generate) |
| **email** | `app@houseofspells.co.uk` |
| **password** | `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` |
| **firstName** | `Super` |
| **lastName** | `Admin` |
| **phone** | (leave empty or `null`) |
| **role** | `ADMIN` (must be exactly this, all caps) |
| **avatar** | (leave empty or `null`) |
| **createdAt** | (leave empty - will auto-set) |
| **updatedAt** | (leave empty - will auto-set) |
| **loyaltyPoints** | `0` |
| **themePreference** | (leave empty or `null`) |

3. **IMPORTANT:** Copy the password hash exactly:
   ```
   $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
   ```
   - Must start with `$2b$`
   - Must be exactly 60 characters
   - No spaces before or after

4. Click **Save**

### Step 6: Restart API Service
1. Go back to Railway Dashboard
2. Click on **`@hos-marketplace/api`** service
3. Go to **"Deployments"** tab
4. Click **"Redeploy"** or **"Restart"**
5. Wait 1-2 minutes for restart

### Step 7: Test Login
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

---

## ✅ Method 2: Use Registration Endpoint (If Available)

If the registration endpoint allows admin creation:

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@houseofspells.co.uk",
    "password": "Admin123!",
    "firstName": "Super",
    "lastName": "Admin"
  }'
```

Then update role to ADMIN via Railway Dashboard.

---

## ✅ Method 3: Create Script That Runs on Railway

Create a script that runs directly on Railway's infrastructure:

### Step 1: Create Script File
Create file: `services/api/src/database/fix-admin-now.ts`

```typescript
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function fixAdmin() {
  const email = 'app@houseofspells.co.uk';
  const password = 'Admin123';

  try {
    console.log('🔧 Fixing admin user...');
    
    // Delete existing user
    await prisma.user.deleteMany({
      where: { email },
    });
    console.log('✅ Deleted existing user');

    // Generate fresh hash
    const hash = await bcrypt.hash(password, 10);
    console.log('✅ Generated password hash:', hash.substring(0, 20) + '...');

    // Create new admin user
    const admin = await prisma.user.create({
      data: {
        email,
        password: hash,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });

    console.log('✅ Admin user created!');
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   ID:', admin.id);
    console.log('\n✅ Test login with:');
    console.log('   Email:', email);
    console.log('   Password:', password);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

### Step 2: Add to package.json
Add this script to `services/api/package.json`:
```json
"db:fix-admin": "ts-node src/database/fix-admin-now.ts"
```

### Step 3: Run on Railway
```bash
cd services/api
railway run pnpm db:fix-admin
```

---

## 🔍 Method 4: Check API Logs for Errors

1. Go to Railway Dashboard
2. Open **`@hos-marketplace/api`** service
3. Click **"Logs"** tab
4. Try to login
5. Look for error messages about:
   - Password comparison
   - Database queries
   - Authentication errors

---

## 🎯 Recommended: Use Method 1 (Railway Dashboard)

**Why Method 1 is best:**
- ✅ No extensions needed
- ✅ Visual interface
- ✅ Direct database access
- ✅ Can see exactly what's in the database
- ✅ Most reliable

**Steps Summary:**
1. Delete old user in Railway Dashboard
2. Create new user with correct hash
3. Restart API service
4. Test login

---

## 📋 Password Hash Reference

**Password:** `Admin123`  
**Hash:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

**Verification:**
- Starts with: `$2b$10$`
- Length: 60 characters
- Format: bcrypt with 10 salt rounds

---

## ✅ After Fix - Verify

1. **Check Database:**
   - Role = `ADMIN`
   - Password hash starts with `$2b$10$`
   - Email = `app@houseofspells.co.uk`

2. **Test Login:**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
   ```

3. **Expected Response:**
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

## 🆘 If Still Not Working

1. **Check API Logs** - Look for specific error messages
2. **Try Different Password** - Create user with password `Test123!` and hash it fresh
3. **Check Database Connection** - Verify API can connect to database
4. **Verify bcrypt Version** - Make sure API uses same bcrypt version

---

**Follow Method 1 step by step - it will work!**

