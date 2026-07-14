-- Add optional photo attachments to product reviews
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
