# Options to Verify Admin User

## Option 1: Run on Railway (Recommended)

Since your database is on Railway, run the verification command there:

```bash
cd services/api
railway run pnpm db:verify-admin
```

This uses Railway's `DATABASE_URL` automatically.

## Option 2: Use Railway Dashboard SQL

1. Go to Railway Dashboard
2. Open your PostgreSQL service
3. Click "Query" or "Data" tab
4. Run this SQL:

```sql
SELECT 
  id,
  email,
  role,
  "firstName",
  "lastName",
  LEFT(password, 20) as password_start,
  "createdAt",
  "updatedAt"
FROM users
WHERE email = 'app@houseofspells.co.uk';
```

**Expected Result:**
- Email: `app@houseofspells.co.uk`
- Role: `ADMIN`
- Password should start with: `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

## Option 3: Test Login Directly

Test if admin login works via API:

```bash
# Test production API
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
```

If login succeeds, admin exists and is configured correctly!

## Option 4: Set Up Local .env (For Local Testing)

If you want to test locally, create `.env` file:

```bash
cd services/api
# Create .env file with your Railway DATABASE_URL
echo "DATABASE_URL=postgresql://..." > .env
```

Then run:
```bash
pnpm db:verify-admin
```

---

**Quick Test:** Use Option 3 (test login) - it's the fastest way to verify admin works!


