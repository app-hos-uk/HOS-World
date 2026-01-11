# Get Your Public Database URL

## Problem
The internal Railway URL (`postgres.railway.internal`) doesn't work from your local machine. You need the **public proxy URL**.

## Solution Options

### Option 1: Check Your .env File

The `.env` file should have a `DATABASE_URL` that looks like this:
```
DATABASE_URL="postgresql://postgres:password@gondola.proxy.rlwy.net:15729/railway"
```

This is the **public proxy URL** that works from your local machine.

**Find it:**
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
cat .env | grep DATABASE_URL
```

**Then use it:**
```bash
psql "YOUR_PUBLIC_DATABASE_URL_FROM_ENV" -f prisma/migrations/add_stock_transfer_and_movement.sql
```

---

### Option 2: Use Railway CLI (Easiest)

If you have Railway CLI installed:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
railway run psql -f prisma/migrations/add_stock_transfer_and_movement.sql
```

Railway CLI automatically uses the correct database URL from your Railway project.

---

### Option 3: Get URL from Railway Dashboard

1. Go to your Railway project dashboard
2. Click on your PostgreSQL service
3. Go to the "Connect" or "Variables" tab
4. Copy the `DATABASE_URL` that starts with `postgresql://...` and has a domain like `*.proxy.rlwy.net`
5. Use that URL in the psql command

---

### Option 4: Use Environment Variable

If your `.env` file has the correct `DATABASE_URL`:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# This will use the DATABASE_URL from .env
psql $DATABASE_URL -f prisma/migrations/add_stock_transfer_and_movement.sql
```

---

## Quick Check: What URL Format Do You Need?

**❌ Internal URL (won't work locally):**
```
postgresql://postgres:password@postgres.railway.internal:5432/railway
```

**✅ Public Proxy URL (works locally):**
```
postgresql://postgres:password@gondola.proxy.rlwy.net:15729/railway
```
or
```
postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

---

## Once You Have the Correct URL

Run this command (replace with your actual public URL):

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"

# Replace YOUR_PUBLIC_URL with the URL from your .env or Railway dashboard
psql "YOUR_PUBLIC_URL" -f prisma/migrations/add_stock_transfer_and_movement.sql
```

Then verify:
```bash
psql "YOUR_PUBLIC_URL" -c "\dt stock_*"
```
