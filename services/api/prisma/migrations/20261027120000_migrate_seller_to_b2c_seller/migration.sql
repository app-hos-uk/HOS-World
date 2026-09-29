-- Migrate all users with the deprecated SELLER role to B2C_SELLER.
-- The SELLER enum value is kept in PostgreSQL for now so Prisma can still
-- read any rows that haven't been migrated yet during rolling deploys.

UPDATE "users" SET "role" = 'B2C_SELLER' WHERE "role" = 'SELLER';

-- Also ensure seller profiles have an explicit sellerType
UPDATE "sellers"
SET "sellerType" = 'B2C_SELLER'
WHERE "sellerType" IS NULL
  AND "userId" IN (SELECT "id" FROM "users" WHERE "role" = 'B2C_SELLER');
