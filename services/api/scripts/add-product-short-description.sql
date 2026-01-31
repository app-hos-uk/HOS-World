-- Run this if checkout/cart returns 500 due to missing shortDescription column.
--
-- Option 1 (uses services/api/.env DATABASE_URL):
--   cd services/api && pnpm prisma db execute --file scripts/add-product-short-description.sql
--
-- Option 2 (psql with .env loaded):
--   cd services/api && set -a && source .env 2>/dev/null; set +a && psql "$DATABASE_URL" -f scripts/add-product-short-description.sql
--
-- Option 3 (Railway): run the SQL below in Railway → Database → Query.
--
-- Create services/api/.env from env.example and set DATABASE_URL if you get "Environment variable not found: DATABASE_URL".

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
