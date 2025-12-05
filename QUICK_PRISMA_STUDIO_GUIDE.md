# 🚀 Quick Guide: Create Team Users via Prisma Studio

## Step-by-Step Instructions

### Step 1: Open Prisma Studio

Run this command (I've started it for you):

```bash
cd services/api
railway run pnpm db:studio
```

Prisma Studio will open automatically in your browser at `http://localhost:5555`

---

### Step 2: Create Each User

**In Prisma Studio:**

1. Click on **"User"** model in the left sidebar
2. Click **"Add record"** button (+ button)
3. Fill in the form for each user (create 7 total):

---

## 📋 Users to Create

### User 1: ADMIN
- **email:** `admin@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `Admin`
- **lastName:** `User`
- **role:** Select `ADMIN` (must be UPPERCASE)
- **avatar:** (leave empty)
- **characterAvatar:** (leave empty)
- Click **"Save 1 change"**

### User 2: PROCUREMENT
- **email:** `procurement@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `Procurement`
- **lastName:** `Manager`
- **role:** `PROCUREMENT`
- Click **"Save 1 change"**

### User 3: FULFILLMENT
- **email:** `fulfillment@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `Fulfillment`
- **lastName:** `Staff`
- **role:** `FULFILLMENT`
- Click **"Save 1 change"**

### User 4: CATALOG
- **email:** `catalog@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `Catalog`
- **lastName:** `Editor`
- **role:** `CATALOG`
- Click **"Save 1 change"**

### User 5: MARKETING
- **email:** `marketing@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `Marketing`
- **lastName:** `Manager`
- **role:** `MARKETING`
- Click **"Save 1 change"**

### User 6: FINANCE
- **email:** `finance@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `Finance`
- **lastName:** `Manager`
- **role:** `FINANCE`
- Click **"Save 1 change"**

### User 7: CMS_EDITOR
- **email:** `cms@hos.test`
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **firstName:** `CMS`
- **lastName:** `Editor`
- **role:** `CMS_EDITOR`
- Click **"Save 1 change"**

---

## ✅ Verify Users Created

In Prisma Studio:
1. Click "User" model
2. You should see all 10 users (@hos.test emails)
3. Check that roles are correct (UPPERCASE)

---

## 🎯 Quick Copy-Paste

**Password Hash (same for all):**
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**Password:** `Test123!`

---

**Prisma Studio should open automatically in your browser!**

