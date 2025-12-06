# How to Run the Migration SQL

## Railway Doesn't Have a Built-in SQL Editor

Railway's PostgreSQL service doesn't include a web-based SQL query editor. We need to use an external PostgreSQL client.

## Option 1: Use a PostgreSQL Client (Easiest)

### Step 1: Get Your Database Connection String

1. In Railway Dashboard, click on **Postgres** service
2. Click **"Connect"** button (top right)
3. Click **"Public Network"** tab (if you want to connect from your computer)
4. Copy the connection string - it will look like:
   ```
   postgresql://postgres:PASSWORD@HOST:PORT/railway
   ```
   OR use the **"Private Network"** connection string if connecting from Railway services

### Step 2: Install PostgreSQL Client (if needed)

**On macOS:**
```bash
brew install postgresql
```

**On Linux:**
```bash
sudo apt-get install postgresql-client
```

**On Windows:**
Download from: https://www.postgresql.org/download/windows/

### Step 3: Run the Migration SQL

**Method A: Using psql command line**
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api/prisma/migrations"
psql "YOUR_CONNECTION_STRING_HERE" -f run_and_baseline.sql
```

**Method B: Using psql interactive**
```bash
psql "YOUR_CONNECTION_STRING_HERE"
```
Then paste the SQL from `run_and_baseline.sql` and press Enter.

---

## Option 2: Use a GUI PostgreSQL Client

### Popular Options:

1. **TablePlus** (macOS/Windows/Linux)
   - Download: https://tableplus.com/
   - Free and easy to use
   - Connect using the connection string from Railway

2. **pgAdmin** (All platforms)
   - Download: https://www.pgadmin.org/
   - Open source, full-featured

3. **DBeaver** (All platforms)
   - Download: https://dbeaver.io/
   - Free, open source

4. **Postico** (macOS only)
   - Download: https://eggerapps.at/postico/
   - Beautiful UI, paid but has free trial

### Steps for Any GUI Client:

1. **Get Connection Details from Railway:**
   - Click "Connect" button in Railway
   - Copy the connection string or note:
     - Host
     - Port
     - Database name (usually "railway")
     - Username (usually "postgres")
     - Password

2. **Connect to Database:**
   - Open your PostgreSQL client
   - Create new connection
   - Enter the details from Railway
   - Connect

3. **Run the SQL:**
   - Open a new query window
   - Copy entire contents of: `services/api/prisma/migrations/run_and_baseline.sql`
   - Paste into query window
   - Execute/Run the query

---

## Option 3: Use Railway CLI with Script

If you have Railway CLI linked, you can create a script:

```bash
# Create a script file
cat > run_migration.sh << 'EOF'
#!/bin/bash
railway run psql $DATABASE_URL -f prisma/migrations/run_and_baseline.sql
EOF

chmod +x run_migration.sh
cd services/api
railway run bash -c "cat prisma/migrations/run_and_baseline.sql | psql \$DATABASE_URL"
```

---

## Option 4: Use Online PostgreSQL Client

1. **Supabase SQL Editor** (if you have access)
2. **Adminer** (web-based, can connect to external databases)
3. **phpPgAdmin** (web-based)

---

## Recommended: Use TablePlus (Easiest for macOS)

1. **Download TablePlus:** https://tableplus.com/
2. **Install and open**
3. **Click "Create a new connection"**
4. **Select PostgreSQL**
5. **Get connection details from Railway:**
   - Go to Railway → Postgres → Connect
   - Copy connection string or note individual values
6. **Enter in TablePlus:**
   - Host: (from Railway)
   - Port: (from Railway, usually 5432)
   - User: postgres
   - Password: (from Railway)
   - Database: railway
7. **Click "Test" then "Connect"**
8. **Open SQL Editor** (Cmd+T or click SQL icon)
9. **Copy and paste** the entire `run_and_baseline.sql` file
10. **Click "Run"** (Cmd+R)

---

## After Running the SQL

1. **Verify it worked:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name = 'country';
   ```
   Should return: `country`

2. **Restart API service:**
   - Go to Railway → @hos-marketplace/api
   - Click "Redeploy" or wait for auto-restart
   - Check logs for: "✅ Database is up to date - no pending migrations"

---

## Quick Test Connection

To test if you can connect:

```bash
psql "YOUR_CONNECTION_STRING" -c "SELECT version();"
```

If this works, you can run the migration SQL!

