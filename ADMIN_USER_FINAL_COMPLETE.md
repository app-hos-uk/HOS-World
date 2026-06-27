# 👤 Admin User - FINAL Complete Fields (All Required Fields)

## ✅ Complete Field Values (NO NULL ERRORS)

| Field | Value | Notes |
|-------|-------|-------|
| **id** | `be47307a-2afc-4d83-b44a-ba473f09458b` | UUID (required) |
| **email** | `app@houseofspells.co.uk` | Required |
| **password** | `[bcrypt-hash-redacted]` | Required |
| **firstName** | `Super` | Required |
| **lastName** | `Admin` | Required |
| **phone** | *(leave empty)* | Optional |
| **role** | `ADMIN` | Required |
| **avatar** | *(leave empty)* | Optional |
| **createdAt** | `2025-12-04 06:55:50.276` | Use current timestamp |
| **updatedAt** | `2025-12-04 06:55:50.276` | **MUST BE SAME AS createdAt** |
| **loyaltyPoints** | `0` | Required |
| **themePreference** | *(leave empty)* | Optional |
| **cartId** | *(leave empty)* | Optional |

---

## 🔑 Critical: Timestamp Fields

**Both `createdAt` and `updatedAt` MUST have values!**

Use the **SAME timestamp** for both:
- `createdAt`: `2025-12-04 06:55:50.276`
- `updatedAt`: `2025-12-04 06:55:50.276`

**Or use current timestamp:**
- Format: `YYYY-MM-DD HH:MM:SS.mmm`
- Example: `2025-12-04 07:00:00.000`

---

## 📝 Step-by-Step (FINAL - No Errors)

### Step 1: Click "+ Row" Button
- In Railway Dashboard → PostgreSQL → Data → users table

### Step 2: Fill ALL Required Fields

**id:**
```
be47307a-2afc-4d83-b44a-ba473f09458b
```

**email:**
```
app@houseofspells.co.uk
```

**password:**
```
[bcrypt-hash-redacted]
```

**firstName:**
```
Super
```

**lastName:**
```
Admin
```

**phone:**
- Leave empty

**role:**
```
ADMIN
```

**avatar:**
- Leave empty

**createdAt:**
```
2025-12-04 06:55:50.276
```
*(Use current timestamp or same as updatedAt)*

**updatedAt:**
```
2025-12-04 06:55:50.276
```
**⚠️ MUST HAVE A VALUE - Use same as createdAt**

**loyaltyPoints:**
```
0
```

**themePreference:**
- Leave empty

**cartId:**
- Leave empty

### Step 3: Save
- Click "Save" button

---

## 🎯 Quick Copy - All Values

**ID:**
```
be47307a-2afc-4d83-b44a-ba473f09458b
```

**Email:**
```
app@houseofspells.co.uk
```

**Password:**
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

**Created At:**
```
2025-12-04 06:55:50.276
```

**Updated At:**
```
2025-12-04 06:55:50.276
```
**⚠️ MUST BE SAME AS createdAt**

**Loyalty Points:**
```
0
```

---

## ✅ Alternative: Use Current Timestamp

If you want to use the current time:

1. Get current timestamp (use this format):
   ```
   YYYY-MM-DD HH:MM:SS.mmm
   ```

2. Use the **SAME value** for both `createdAt` and `updatedAt`

**Example:**
- createdAt: `2025-12-04 07:00:00.000`
- updatedAt: `2025-12-04 07:00:00.000` (same value)

---

## 🔍 Timestamp Format

**Format:** `YYYY-MM-DD HH:MM:SS.mmm`

**Examples:**
- `2025-12-04 06:55:50.276`
- `2025-12-04 07:00:00.000`
- `2025-12-04 12:30:45.123`

**Important:**
- Use 24-hour format (HH:MM:SS)
- Include milliseconds (.mmm) if possible
- Use UTC time (or your server timezone)

---

## ✅ After Creating User

1. **Verify:**
   - All fields are filled (no null errors)
   - `role` = `ADMIN`
   - `password` starts with `$2b$10$`
   - `createdAt` and `updatedAt` both have values

2. **Restart API:**
   - Railway Dashboard → API service → Deployments → Redeploy

3. **Test Login:**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "`$SEED_ADMIN_PASSWORD` (env)"}'
   ```

---

**Now with `updatedAt` filled, it should work without errors!**

