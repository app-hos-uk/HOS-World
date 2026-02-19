-- AlterTable
ALTER TABLE "product_submissions" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
