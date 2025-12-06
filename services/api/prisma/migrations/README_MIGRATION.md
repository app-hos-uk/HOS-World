# Global Platform Features Migration

This migration adds support for global platform features including multi-currency support, GDPR compliance, and enhanced user profiles.

## What This Migration Does

1. **Adds new user fields:**
   - `country` - User's country
   - `whatsappNumber` - WhatsApp contact number
   - `preferredCommunicationMethod` - Communication preference (EMAIL, SMS, WHATSAPP, PHONE)
   - `currencyPreference` - Preferred currency (defaults to GBP)
   - `ipAddress` - Last known IP for country detection
   - `gdprConsent` - GDPR consent status
   - `gdprConsentDate` - When consent was given
   - `dataProcessingConsent` - Granular consent preferences (JSON)
   - `countryDetectedAt` - Last IP-based country detection

2. **Adds new customer fields:**
   - `country` - Customer's country
   - `currencyPreference` - Currency preference (defaults to GBP)

3. **Creates new tables:**
   - `currency_exchange_rates` - Cached exchange rates (GBP base)
   - `gdpr_consent_logs` - Audit log for consent changes

4. **Updates currency defaults:**
   - Changes default currency from USD to GBP in:
     - `products`
     - `carts`
     - `orders`
     - `payments`
     - `settlements`

5. **Creates indexes** for performance optimization

6. **Initializes default exchange rates** (approximate values, will be updated by service)

## How to Run

### Option 1: Using Prisma Migrate (Recommended)

```bash
cd services/api
npx prisma migrate dev --name add_global_features
```

### Option 2: Using Direct SQL

```bash
cd services/api
psql $DATABASE_URL -f prisma/migrations/add_global_features.sql
```

### Option 3: Using Railway CLI

```bash
railway run psql $DATABASE_URL -f prisma/migrations/add_global_features.sql
```

## After Migration

1. **Generate Prisma Client:**
   ```bash
   cd services/api
   npx prisma generate
   ```

2. **Restart the API service** to load the new schema

3. **Verify the migration:**
   - Check that new columns exist in `users` and `customers` tables
   - Verify `currency_exchange_rates` and `gdpr_consent_logs` tables are created
   - Check that currency defaults are updated

4. **Test the features:**
   - Register a new user and verify country/currency fields are saved
   - Check that currency conversion service works
   - Verify GDPR consent banner appears for new users

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS "gdpr_consent_logs";
DROP TABLE IF EXISTS "currency_exchange_rates";

-- Remove new columns from users
ALTER TABLE "users" 
DROP COLUMN IF EXISTS "country",
DROP COLUMN IF EXISTS "whatsappNumber",
DROP COLUMN IF EXISTS "preferredCommunicationMethod",
DROP COLUMN IF EXISTS "currencyPreference",
DROP COLUMN IF EXISTS "ipAddress",
DROP COLUMN IF EXISTS "gdprConsent",
DROP COLUMN IF EXISTS "gdprConsentDate",
DROP COLUMN IF EXISTS "dataProcessingConsent",
DROP COLUMN IF EXISTS "countryDetectedAt";

-- Remove new columns from customers
ALTER TABLE "customers"
DROP COLUMN IF EXISTS "country",
DROP COLUMN IF EXISTS "currencyPreference";

-- Revert currency defaults (optional)
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'USD';
```

## Notes

- Existing users will have `currencyPreference` set to 'GBP' by default
- Existing users will have `country` as NULL (can be set manually or via profile update)
- Exchange rates will be automatically updated by the CurrencyService
- GDPR consent logs will be created when users grant/revoke consent

