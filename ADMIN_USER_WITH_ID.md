# 👤 Admin User - Complete Fields WITH ID

## ❌ Error Fixed: ID Field Required

The `id` field cannot be null. You need to provide a UUID value.

---

## ✅ Complete Field Values (WITH ID)

| Field | Value |
|-------|-------|
| **id** | `1c069d31-7026-47ba-a447-e8faeee08f95` *(or generate new UUID)* |
| **email** | `app@houseofspells.co.uk` |
| **password** | `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` |
| **firstName** | `Super` |
| **lastName** | `Admin` |
| **phone** | *(leave empty or `null`)* |
| **role** | `ADMIN` |
| **avatar** | *(leave empty or `null`)* |
| **createdAt** | *(leave empty - will auto-set)* |
| **updatedAt** | *(leave empty - will auto-set)* |
| **loyaltyPoints** | `0` |
| **themePreference** | *(leave empty or `null`)* |
| **cartId** | *(leave empty or `null`)* |

---

## 🔑 ID Field - Use One of These:

**Option 1: Use Existing ID (if you deleted the old user)**
```
1c069d31-7026-47ba-a447-e8faeee08f95
```

**Option 2: Generate New UUID**
- Use this UUID generator: https://www.uuidgenerator.net/
- Or run in terminal: `python3 -c "import uuid; print(uuid.uuid4())"`
- Or use: `uuidgen` command (if available)

**Option 3: Use This New UUID**
```
550e8400-e29b-41d4-a716-446655440000
```

---

## 📝 Step-by-Step (Fixed)

### Step 1: Click "+ Row" Button
- In Railway Dashboard → PostgreSQL → Data → users table
- Click purple "+ Row" button

### Step 2: Fill ALL Fields

**id:**
- Type: `1c069d31-7026-47ba-a447-e8faeee08f95`
- Or generate a new UUID

**email:**
- Type: `app@houseofspells.co.uk`

**password:**
- Copy exactly (no spaces):
  ```
  $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
  ```

**firstName:**
- Type: `Super`

**lastName:**
- Type: `Admin`

**phone:**
- Leave empty or type `null`

**role:**
- Type: `ADMIN` (all caps, no quotes)

**avatar:**
- Leave empty or type `null`

**createdAt:**
- Leave empty (will auto-set)

**updatedAt:**
- Leave empty (will auto-set)

**loyaltyPoints:**
- Type: `0`

**themePreference:**
- Leave empty or type `null`

**cartId:**
- Leave empty or type `null`

### Step 3: Save
- Click "Save" button
- Should work now!

---

## 🎯 Quick Copy Values

**ID (UUID):**
```
1c069d31-7026-47ba-a447-e8faeee08f95
```

**Email:**
```
app@houseofspells.co.uk
```

**Password Hash:**
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**First Name:**
```
Super
```

**Last Name:**
```
Admin
```

**Role:**
```
ADMIN
```

**Loyalty Points:**
```
0
```

---

## ✅ After Creating

1. **Verify User Created:**
   - Check that all fields are saved correctly
   - Verify `role` = `ADMIN`
   - Verify `password` starts with `$2b$10$`

2. **Restart API Service:**
   - Railway Dashboard → API service → Deployments → Redeploy

3. **Test Login:**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
   ```

---

**Now with the ID field filled, it should work!**

