-- Add SEO and shipping dimension fields to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(10, 3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "length" DECIMAL(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "width" DECIMAL(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "height" DECIMAL(10, 2);
