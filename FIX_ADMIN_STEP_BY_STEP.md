# 🔧 Fix Admin User - Step by Step Guide

## Current Location
You're in Railway Dashboard → PostgreSQL → Database → **Data** tab

---

## ✅ Step-by-Step Instructions

### Step 1: Click on the `users` Table
1. In the grid of tables you see, find and **click on the `users` table**
   - It should be one of the table cards with a blue table icon
   - Look for the card that says `users`

### Step 2: View the Admin User
1. After clicking `users`, you'll see a table with all users
2. **Find the row** with email: `app@houseofspells.co.uk`
3. You should see columns like: `id`, `email`, `password`, `first`, `last`, `role`, etc.

### Step 3: Edit the User Row
1. **Click on the row** with `app@houseofspells.co.uk` to select it
2. Look for an **"Edit"** button or **double-click** the row
3. Or look for a **pencil icon** (✏️) or **edit icon**

### Step 4: Update the Fields
In the edit form, make sure these fields are set:

- **email:** `app@houseofspells.co.uk` (should already be correct)
- **password:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
- **role:** `ADMIN` (⚠️ **IMPORTANT:** Must be exactly `ADMIN` in all caps, no quotes)
- **firstName:** `Super`
- **lastName:** `Admin`
- **createdAt:** (should have a timestamp, if empty use current date)
- **updatedAt:** (should update automatically, or set to current date)

### Step 5: Save Changes
1. Click **"Save"** or **"Update"** button
2. The changes should be saved

---

## 🔍 Alternative: If You Can't Edit Directly

### Option A: Use Railway's "Connect" Button

1. **Click the purple "Connect" button** (top right, next to the tabs)
2. This will show you connection details
3. Copy the connection string
4. Use a database client to connect (see below)

### Option B: Use a Database Client

#### Using VS Code (Easiest)

1. **Install PostgreSQL Extension:**
   - Open VS Code
   - Go to Extensions (Cmd+Shift+X on Mac)
   - Search for: **"PostgreSQL"** by Chris Kolkman
   - Click **Install**

2. **Connect to Database:**
   - Click the "Connect" button in Railway
   - Copy the connection string (it will look like: `postgresql://postgres:password@host:port/railway`)
   - In VS Code, open Command Palette (Cmd+Shift+P)
   - Type: `PostgreSQL: Add Connection`
   - Paste the connection string
   - Click Connect

3. **Run SQL Query:**
   - Right-click on the connection
   - Select "New Query"
   - Paste this SQL:
   ```sql
   UPDATE users
   SET 
     role = 'ADMIN',
     password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
     "firstName" = COALESCE("firstName", 'Super'),
     "lastName" = COALESCE("lastName", 'Admin'),
     "updatedAt" = NOW()
   WHERE email = 'app@houseofspells.co.uk';
   ```
   - Click "Run" or press Cmd+Enter

#### Using DBeaver (Free Database Tool)

1. **Download DBeaver:**
   - Visit: https://dbeaver.io/download/
   - Download and install

2. **Create Connection:**
   - Open DBeaver
   - Click "New Database Connection"
   - Select "PostgreSQL"
   - Get connection details from Railway's "Connect" button
   - Fill in:
     - Host: (from connection string)
     - Port: (usually 5432)
     - Database: `railway`
     - Username: `postgres`
     - Password: (from connection string)
   - Click "Test Connection" then "Finish"

3. **Run SQL:**
   - Right-click on your connection → SQL Editor → New SQL Script
   - Paste the UPDATE SQL above
   - Click "Execute SQL" (or press Ctrl+Enter)

---

## ✅ Quick Method: Railway Table Editor

If Railway's table editor allows direct editing:

1. **Click on `users` table** (in the grid)
2. **Find the row** with `app@houseofspells.co.uk`
3. **Click on the `role` column** for that row
4. **Change it to:** `ADMIN` (all caps, no quotes)
5. **Click on the `password` column**
6. **Change it to:** `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
7. **Click Save** (or the changes might auto-save)

---

## 🎯 What to Look For

When you click on the `users` table, you should see:
- A table/grid view with rows and columns
- Columns like: `id`, `email`, `password`, `role`, `firstName`, `lastName`, etc.
- A row with email `app@houseofspells.co.uk`

**Check the `role` column:**
- If it says `CUSTOMER` or is empty → Change to `ADMIN`
- If it already says `ADMIN` → Check the password hash

---

## 🔍 Verify After Update

After making changes, verify:

1. **In Railway:**
   - Refresh the `users` table view
   - Check that `role` = `ADMIN` for `app@houseofspells.co.uk`

2. **Test Login:**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
   ```

   Should return `200 OK` with a token!

---

## 📋 Summary

**Easiest Method:**
1. Click `users` table in Railway
2. Find row with `app@houseofspells.co.uk`
3. Edit the `role` field to `ADMIN`
4. Edit the `password` field to the hash above
5. Save

**If that doesn't work:**
- Use VS Code with PostgreSQL extension (recommended)
- Or use DBeaver database client

**No other extensions needed** - Railway's interface should work, or use one of the database clients above.

