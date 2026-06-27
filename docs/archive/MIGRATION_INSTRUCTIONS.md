# Database Migration Instructions

## Migration Status
✅ Migration files created in proper Prisma format:
- `services/api/prisma/migrations/[timestamp]_add_global_features/migration.sql`

## How to Apply the Migration

### Option 1: Automatic on Railway Deployment (Recommended)
The migration will run automatically when you deploy to Railway because:
1. The PrismaService runs `prisma migrate deploy` on startup in production
2. The migration files are included in the Docker image
3. Railway will apply pending migrations automatically

**Just deploy to Railway and the migration will run!**

### Option 2: Manual via Railway CLI
If you want to run it manually:

```bash
cd services/api
railway link  # Link to your Railway project if not already linked
railway run npx prisma migrate deploy
```

### Option 3: Manual via Railway Web Interface
1. Go to Railway Dashboard
2. Click on your API service (`@hos-marketplace/api`)
3. Go to "Deployments" tab
4. Click "New Deployment" or use the "Run Command" feature
5. Run: `npx prisma migrate deploy`

### Option 4: Direct SQL Execution (Alternative)
If Prisma migrations don't work, you can run the SQL directly:

1. Go to Railway Dashboard
2. Click on PostgreSQL service
3. Go to "Data" tab or use "Query" feature
4. Copy the contents of `services/api/prisma/migrations/add_global_features.sql`
5. Execute the SQL

## What the Migration Does

1. **Adds new columns to `users` table:**
   - country, whatsappNumber, preferredCommunicationMethod
   - currencyPreference (defaults to GBP)
   - ipAddress, gdprConsent, gdprConsentDate
   - dataProcessingConsent (JSON), countryDetectedAt

2. **Adds new columns to `customers` table:**
   - country, currencyPreference

3. **Creates new tables:**
   - `currency_exchange_rates` - For cached exchange rates
   - `gdpr_consent_logs` - For consent audit trail

4. **Updates currency defaults:**
   - Changes default from USD to GBP in products, carts, orders, payments, settlements

5. **Creates indexes** for performance

6. **Backfills data:**
   - Sets currencyPreference to GBP for existing users

## Verification

After migration, verify:

```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('country', 'currencyPreference', 'gdprConsent');

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('currency_exchange_rates', 'gdpr_consent_logs');

-- Check currency defaults
SELECT column_name, column_default FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'currency';
```

## Rollback (if needed)

If you need to rollback, see the SQL file comments or run:

```sql
-- See services/api/prisma/migrations/add_global_features.sql for rollback SQL
```

## Next Steps After Migration

1. **Generate Prisma Client:**
   ```bash
   cd services/api
   npx prisma generate
   ```

2. **Restart the API service** on Railway

3. **Test the features:**
   - Register a new user (should see country detection)
   - Check currency conversion works
   - Verify GDPR consent banner appears

---

**Note:** The migration uses `IF NOT EXISTS` and `IF EXISTS` checks, so it's safe to run multiple times.

