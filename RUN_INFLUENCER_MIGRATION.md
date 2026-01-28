# Fix influencer login (401 / 500)

## Why login fails

- **401 Invalid credentials**: The user `influencer@hos.test` does not exist on production yet, or the password is wrong.
- **500 from create-influencer-test-user**: The database enum `UserRole` does not include `INFLUENCER` yet (migration not run).

## 1. Run migrations on production (preferred)

The root Dockerfile is now set to run `npx prisma migrate deploy` on startup. After the next deploy, migrations (including adding `INFLUENCER` to `UserRole`) will run automatically.

Then create the test user:

```bash
curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/admin/create-influencer-test-user" -H "Content-Type: application/json"
```

Then log in with **influencer@hos.test** / **Test!123**.

## 2. Fix immediately without redeploy (manual SQL)

If you need the influencer user **before** the next deploy:

1. **Add the enum value** using your production database URL (Railway Postgres or `DATABASE_URL`):

   ```bash
   # Replace with your real DATABASE_URL from Railway
   psql "$DATABASE_URL" -c "
   DO \$\$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'UserRole' AND e.enumlabel = 'INFLUENCER'
     ) THEN
       ALTER TYPE \"UserRole\" ADD VALUE 'INFLUENCER';
     END IF;
   END \$\$;
   "
   ```

   Or in Railway: open your Postgres service → Query tab → paste the `DO $$ ... $$;` block (without the `psql` wrapper) and run it.

2. **Create the test user**:

   ```bash
   curl -X POST "https://hos-marketplaceapi-production.up.railway.app/api/admin/create-influencer-test-user" -H "Content-Type: application/json"
   ```

3. **Log in** with **influencer@hos.test** / **Test!123**.
