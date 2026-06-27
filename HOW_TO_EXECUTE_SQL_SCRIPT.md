# 🔧 How to Execute SQL Script - Alternative Methods

Since Railway doesn't have a visible SQL query interface in the dashboard, here are alternative methods:

---

## 🎯 Method 1: Use Railway CLI with Database Proxy (Recommended)

### Step 1: Connect to Database via Railway CLI

```bash
cd services/api
railway link  # Make sure you're linked to the project
railway connect postgres
```

This will create a database proxy connection.

### Step 2: Execute SQL in New Terminal

**Open a NEW terminal window** (keep the proxy running), then:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"

# Option A: Using psql directly
PGPASSWORD=your_password psql -h localhost -p <proxy_port> -U postgres -d railway -f scripts/create-team-role-users.sql

# Option B: Using Railway run
cd services/api
railway run --service postgres psql -f ../../scripts/create-team-role-users.sql
```

---

## 🎯 Method 2: Use Prisma Studio (Easiest - Visual)

### Step 1: Open Prisma Studio

```bash
cd services/api
railway run pnpm db:studio
```

Prisma Studio will open in your browser at `http://localhost:5555`

### Step 2: Create Users Manually

For each user, click "User" model → "Add record" → Fill in:

**User 1: ADMIN**
- email: `admin@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `Admin`
- lastName: `User`
- role: `ADMIN` (UPPERCASE)

**User 2: PROCUREMENT**
- email: `procurement@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `Procurement`
- lastName: `Manager`
- role: `PROCUREMENT`

**User 3: FULFILLMENT**
- email: `fulfillment@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `Fulfillment`
- lastName: `Staff`
- role: `FULFILLMENT`

**User 4: CATALOG**
- email: `catalog@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `Catalog`
- lastName: `Editor`
- role: `CATALOG`

**User 5: MARKETING**
- email: `marketing@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `Marketing`
- lastName: `Manager`
- role: `MARKETING`

**User 6: FINANCE**
- email: `finance@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `Finance`
- lastName: `Manager`
- role: `FINANCE`

**User 7: CMS_EDITOR**
- email: `cms@hos.test`
- password: `[bcrypt-hash-redacted]`
- firstName: `CMS`
- lastName: `Editor`
- role: `CMS_EDITOR`

---

## 🎯 Method 3: Use Node.js Script (Automated)

I've created a Node.js script that will work once Railway CLI is properly configured:

```bash
cd services/api
railway run pnpm db:create-team-users
```

**Note:** This requires Railway CLI to be connected to the project.

---

## 🎯 Method 4: Direct Database Connection (If You Have Access)

If you have the public DATABASE_URL from Railway:

```bash
# Get DATABASE_URL from Railway Dashboard → PostgreSQL → Variables tab
# Then run:
psql "$DATABASE_URL" -f scripts/create-team-role-users.sql
```

---

## ✅ Quickest: Use Prisma Studio (Method 2)

**Recommendation:** Use Prisma Studio - it's the easiest and most visual method!

1. Run: `cd services/api && railway run pnpm db:studio`
2. Browser opens automatically
3. Click "User" model
4. Click "Add record" 7 times
5. Fill in details from the list above
6. Done! ✅

---

## 📋 Quick Reference: Password Hash

**For all users:** `[bcrypt-hash-redacted]`

**Password:** ``$TEST_SEED_PASSWORD` (env)`

