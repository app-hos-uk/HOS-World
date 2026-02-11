-- AlterTable
ALTER TABLE "product_submissions" ADD COLUMN IF NOT EXISTS "crossSellerGroupId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_submissions_crossSellerGroupId_idx" ON "product_submissions"("crossSellerGroupId");
