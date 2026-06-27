# 👤 Complete Admin User Fields & Values

## 📋 All Fields for Creating Admin User in Railway Dashboard

When creating a new admin user in Railway Dashboard → PostgreSQL → Data → users table, use these exact values:

---

## ✅ Required Fields (Must Fill)

| Field | Value | Notes |
|-------|-------|-------|
| **id** | *(leave empty)* | Will auto-generate UUID |
| **email** | `app@houseofspells.co.uk` | Must be unique |
| **password** | `[bcrypt-hash-redacted]` | Exact hash, 60 characters, starts with `$2b$10$` |
| **role** | `ADMIN` | Must be exactly `ADMIN` (all caps, no quotes) |
| **firstName** | `Super` | |
| **lastName** | `Admin` | |

---

## ⚪ Optional Fields (Can Leave Empty/Null)

| Field | Value | Notes |
|-------|-------|-------|
| **phone** | `null` or *(leave empty)* | Optional |
| **avatar** | `null` or *(leave empty)* | Optional |
| **createdAt** | *(leave empty)* | Will auto-set to current timestamp |
| **updatedAt** | *(leave empty)* | Will auto-set to current timestamp |
| **loyaltyPoints** | `0` | Default value |
| **themePreference** | `null` or *(leave empty)* | Optional |
| **cartId** | `null` or *(leave empty)* | Optional, will be created when needed |

---

## 📝 Step-by-Step in Railway Dashboard

### Step 1: Click "+ Row" Button
- In the `users` table view
- Click the purple "+ Row" button (bottom left)

### Step 2: Fill Required Fields

**id:**
- Leave empty (auto-generates)

**email:**
- Type: `app@houseofspells.co.uk`

**password:**
- Copy and paste exactly (no spaces):
  ```
  [bcrypt-hash-redacted]
  ```

**firstName:**
- Type: `Super`

**lastName:**
- Type: `Admin`

**role:**
- Type: `ADMIN` (all caps, no quotes)

### Step 3: Fill Optional Fields

**phone:**
- Leave empty or type `null`

**avatar:**
- Leave empty or type `null`

**createdAt:**
- Leave empty (auto-sets)

**updatedAt:**
- Leave empty (auto-sets)

**loyaltyPoints:**
- Type: `0`

**themePreference:**
- Leave empty or type `null`

**cartId:**
- Leave empty or type `null`

### Step 4: Save
- Click "Save" or "Update" button
- Verify the user was created

---

## ✅ Complete Field Summary

```
id: [EMPTY - auto-generates]
email: app@houseofspells.co.uk
password: [bcrypt-hash-redacted]
firstName: Super
lastName: Admin
phone: [EMPTY or null]
role: ADMIN
avatar: [EMPTY or null]
createdAt: [EMPTY - auto-sets]
updatedAt: [EMPTY - auto-sets]
loyaltyPoints: 0
themePreference: [EMPTY or null]
cartId: [EMPTY or null]
```

---

## 🔑 Critical Values

**Password Hash (Copy Exactly):**
```
[bcrypt-hash-redacted]
```

**Role (Must be exact):**
```
ADMIN
```
- All caps
- No quotes
- No spaces

---

## ✅ After Creating User

1. **Verify in Database:**
   - Check that `role` = `ADMIN`
   - Check that `password` starts with `$2b$10$`
   - Check that `email` = `app@houseofspells.co.uk`

2. **Restart API Service:**
   - Railway Dashboard → API service → Deployments → Redeploy

3. **Test Login:**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "`$SEED_ADMIN_PASSWORD` (env)"}'
   ```

---

## 🎯 Quick Copy-Paste Values

**Email:**
```
app@houseofspells.co.uk
```

**Password Hash:**
```
[bcrypt-hash-redacted]
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

**Use these exact values and the admin user will be created correctly!**

