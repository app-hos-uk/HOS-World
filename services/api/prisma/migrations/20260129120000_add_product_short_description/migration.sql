-- Add shortDescription to products (optional brief summary for listings)
ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
