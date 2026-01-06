# 👤 Create Admin - Final Solution

## Problem
The `updatedAt` field is required but Railway's table editor isn't auto-filling it.

## ✅ Solution: Fill in `updatedAt` Field

### In Railway Table Editor:

Fill in these **exact** values:

1. **id:** `1c069d31-7026-47ba-a447-e8faeee08f95` (or generate new UUID)
2. **email:** `app@houseofspells.co.uk`
3. **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
4. **firstName:** `Super`
5. **lastName:** `Admin`
6. **role:** `ADMIN` (type exactly `ADMIN` in all caps, no quotes)
7. **phone:** (leave empty/null)
8. **avatar:** (leave empty/null)
9. **createdAt:** `2025-12-03 21:59:09.231` (use current timestamp)
10. **updatedAt:** `2025-12-03 21:59:09.231` (use SAME timestamp as createdAt)
11. **loyaltyPoints:** `0`
12. **themePreference:** (leave empty/null)

### Important:
- **updatedAt** must have the same value as **createdAt**
- Use format: `YYYY-MM-DD HH:MM:SS.mmm` (e.g., `2025-12-03 21:59:09.231`)
- **role** must be exactly `ADMIN` (all caps, no quotes)

---

## ✅ Alternative: Use Current Timestamp

Get current timestamp:
```bash
date -u +"%Y-%m-%d %H:%M:%S"
```

Then use that value for both `createdAt` and `updatedAt`.

---

## ✅ Best Solution: Use Railway's SQL via Connect Button

1. Click the **"Connect"** button in Railway (top right of Database section)
2. Copy the connection string
3. Use a SQL client (like DBeaver, pgAdmin, or VS Code extension)
4. Run this SQL:

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
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();
```

This SQL will:
- Auto-generate UUID for `id`
- Auto-set `createdAt` and `updatedAt` to current time
- Handle all required fields

---

**The key is to fill in `updatedAt` with the same timestamp as `createdAt`!**



