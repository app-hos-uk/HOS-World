# Test Login Endpoint - Quick Guide

## Default Admin Credentials

Based on the codebase, the default admin credentials are:

- **Email**: `app@houseofspells.co.uk`
- **Password**: `Admin123`

---

## Step 1: Ensure Admin User Exists

Before testing login, make sure the admin user exists:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm db:fix-admin
```

Or use the seed script:

```bash
pnpm db:seed-admin
```

This will create/update the admin user with the default credentials.

---

## Step 2: Test Login

Once the admin user exists, test login:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }'
```

---

## Expected Response

**Success (200 OK):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid",
      "email": "app@houseofspells.co.uk",
      "firstName": "Super",
      "lastName": "Admin",
      "role": "ADMIN"
    }
  },
  "message": "Login successful"
}
```

**Failure (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

---

## Step 3: Use the Token

Copy the `accessToken` from the response and use it for authenticated requests:

```bash
# Save token to variable (replace with actual token)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Use token in API requests
curl -X GET http://localhost:3001/api/v1/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN"
```

---

## Quick Test Script

Save this as `test-login.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3001/api/v1"

echo "🔐 Testing login..."

RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "app@houseofspells.co.uk",
    "password": "Admin123"
  }')

# Check if login was successful
if echo "$RESPONSE" | grep -q "accessToken"; then
  echo "✅ Login successful!"
  echo ""
  echo "Token (first 50 chars):"
  echo "$RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 | cut -c1-50
  echo "..."
  echo ""
  echo "User info:"
  echo "$RESPONSE" | grep -o '"user":{[^}]*}' | head -1
else
  echo "❌ Login failed!"
  echo "$RESPONSE"
  echo ""
  echo "💡 Try running: pnpm db:fix-admin"
fi
```

Make it executable and run:
```bash
chmod +x test-login.sh
./test-login.sh
```

---

## Troubleshooting

### Error: "Invalid credentials"

**Solution 1: Create/Update Admin User**
```bash
cd services/api
pnpm db:fix-admin
```

**Solution 2: Verify Admin Exists**
```bash
pnpm db:verify-admin
```

### Error: "User not found"

Run the admin creation script:
```bash
pnpm db:fix-admin
```

### Error: Connection refused

Make sure the API server is running:
```bash
cd services/api
pnpm dev
```

---

## Alternative: Create Admin via Database

If scripts don't work, you can create admin directly via SQL:

```sql
-- Connect to database
psql "postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@gondola.proxy.rlwy.net:15729/railway"

-- Check if user exists
SELECT id, email, role FROM users WHERE email = 'app@houseofspells.co.uk';

-- If not exists, create (password hash for 'Admin123')
-- You'll need to generate a bcrypt hash or use the pre-hashed one from fix-admin-now.ts
```

---

## Next Steps After Successful Login

1. ✅ Copy the `accessToken`
2. ✅ Test warehouses endpoint
3. ✅ Test stock transfers
4. ✅ Test tax zones
5. ✅ Test admin UI pages
