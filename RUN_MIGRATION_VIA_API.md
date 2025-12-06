# Run Migration via API Endpoint

I've created an admin API endpoint that you can call to run the migration. This works from within Railway's network.

## Step 1: Deploy the New Code

The migration controller has been added. You need to deploy it:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
git add .
git commit -m "Add admin migration endpoint"
git push
```

Wait for Railway to deploy the API service.

## Step 2: Get Your Admin JWT Token

You need to be logged in as an ADMIN user. Get your JWT token:

1. **Login via API:**
   ```bash
   curl -X POST https://your-api-url.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"app@houseofspells.co.uk","password":"your-password"}'
   ```

2. **Copy the `accessToken` from the response**

## Step 3: Call the Migration Endpoint

Once deployed, call the migration endpoint:

```bash
curl -X POST https://your-api-url.railway.app/api/admin/migration/run-global-features \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Replace:
- `your-api-url.railway.app` with your actual Railway API URL
- `YOUR_JWT_TOKEN_HERE` with the token from Step 2

## Step 4: Verify Migration

Check if migration worked:

```bash
curl -X POST https://your-api-url.railway.app/api/admin/migration/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Alternative: Use Frontend Admin Panel

If you have access to the admin dashboard:

1. **Login as admin** at: `https://your-web-url.railway.app/admin`
2. **Navigate to:** Admin → Migration (if we add a UI button)
3. **Click "Run Migration"** button

## What the Endpoint Does

1. ✅ Reads the migration SQL file
2. ✅ Executes all SQL statements
3. ✅ Creates Prisma migrations table
4. ✅ Adds all new columns and tables
5. ✅ Baselines the migration
6. ✅ Returns verification results

## Security

- ✅ Protected by JWT authentication
- ✅ Requires ADMIN role
- ✅ Only accessible to authenticated admin users

## Response Example

```json
{
  "success": true,
  "message": "Migration completed",
  "summary": {
    "totalStatements": 25,
    "successful": 25,
    "errors": 0
  },
  "verification": {
    "countryColumnExists": true
  }
}
```

---

## Quick Test Script

Save this as `run-migration.sh`:

```bash
#!/bin/bash

# Set your API URL
API_URL="https://your-api-url.railway.app"

# Login and get token
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"app@houseofspells.co.uk","password":"YOUR_PASSWORD"}' \
  | jq -r '.accessToken')

echo "Token: $TOKEN"

# Run migration
curl -X POST "$API_URL/api/admin/migration/run-global-features" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Verify
curl -X POST "$API_URL/api/admin/migration/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

Make it executable and run:
```bash
chmod +x run-migration.sh
./run-migration.sh
```

