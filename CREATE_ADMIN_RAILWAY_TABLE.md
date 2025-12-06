# 👤 Create Admin via Railway Table Editor

## Problem
Railway's table editor requires the `id` field to be filled, but it doesn't auto-generate UUIDs.

## ✅ Solution: Fill in the ID Field

### Step 1: Generate a UUID

Run this command to generate a UUID:

```bash
node -e "const { randomUUID } = require('crypto'); console.log(randomUUID());"
```

Or use this online tool: https://www.uuidgenerator.net/

### Step 2: Fill in the Form

In Railway's table editor for the `users` table:

1. **ID field:** Paste the generated UUID (or use the one below)
2. **email:** `app@houseofspells.co.uk`
3. **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
4. **firstName:** `Super`
5. **lastName:** `Admin`
6. **role:** `ADMIN` (select from dropdown if available)
7. **phone:** (leave empty or null)
8. **avatar:** (leave empty or null)
9. **createdAt:** (should auto-fill with current timestamp, or leave as default)
10. **updatedAt:** (should auto-fill with current timestamp, or leave as default)
11. **loyaltyPoints:** `0` (or leave empty)

### Step 3: Click "Insert"

Click the purple **"Insert"** button at the bottom.

---

## 🔑 Pre-Generated UUID (You can use this)

```
550e8400-e29b-41d4-a716-446655440000
```

Or generate a new one using the command above.

---

## ✅ Alternative: Use Railway CLI with SQL

If the form doesn't work, use Railway CLI:

```bash
cd services/api

# Run SQL directly
railway run psql $DATABASE_URL -c "INSERT INTO users (id, email, password, \"firstName\", \"lastName\", role, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), 'app@houseofspells.co.uk', '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Super', 'Admin', 'ADMIN', NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', password = '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';"
```

---

## 📝 Complete Form Values

**ID:** `550e8400-e29b-41d4-a716-446655440000` (or generate new one)  
**email:** `app@houseofspells.co.uk`  
**password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`  
**firstName:** `Super`  
**lastName:** `Admin`  
**role:** `ADMIN`  
**phone:** (empty/null)  
**avatar:** (empty/null)  
**createdAt:** (auto or current timestamp)  
**updatedAt:** (auto or current timestamp)  
**loyaltyPoints:** `0` or empty

---

**The key is to fill in the ID field with a UUID!**


