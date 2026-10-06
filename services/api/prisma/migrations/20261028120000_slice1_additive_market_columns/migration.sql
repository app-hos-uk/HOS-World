-- Slice 1: additive market columns only. No data rewrite, no dropped indexes, no new uniques.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "isAnchorStore" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN "vendorProductId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "vendorProductId" TEXT;

-- AlterTable
ALTER TABLE "product_submissions" ADD COLUMN "marketId" TEXT;

-- AlterTable
ALTER TABLE "founding_members" ADD COLUMN "marketId" TEXT;

-- AlterTable
ALTER TABLE "loyalty_memberships" ADD COLUMN "marketId" TEXT;

-- AlterTable
ALTER TABLE "loyalty_tiers" ADD COLUMN "marketId" TEXT;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN "marketId" TEXT;

-- AlterTable
ALTER TABLE "integration_configs" ADD COLUMN "marketId" TEXT;

-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN "marketCode" TEXT;

-- CreateIndex
CREATE INDEX "cart_items_vendorProductId_idx" ON "cart_items"("vendorProductId");

-- CreateIndex
CREATE INDEX "order_items_vendorProductId_idx" ON "order_items"("vendorProductId");

-- CreateIndex
CREATE INDEX "product_submissions_marketId_idx" ON "product_submissions"("marketId");

-- CreateIndex
CREATE INDEX "founding_members_marketId_idx" ON "founding_members"("marketId");

-- CreateIndex
CREATE INDEX "loyalty_memberships_marketId_idx" ON "loyalty_memberships"("marketId");

-- CreateIndex
CREATE INDEX "loyalty_tiers_marketId_idx" ON "loyalty_tiers"("marketId");

-- CreateIndex
CREATE INDEX "platform_settings_marketId_idx" ON "platform_settings"("marketId");

-- CreateIndex
CREATE INDEX "integration_configs_marketId_idx" ON "integration_configs"("marketId");

-- CreateIndex
CREATE INDEX "EmailTemplate_marketCode_idx" ON "EmailTemplate"("marketCode");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_vendorProductId_fkey" FOREIGN KEY ("vendorProductId") REFERENCES "vendor_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_vendorProductId_fkey" FOREIGN KEY ("vendorProductId") REFERENCES "vendor_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_submissions" ADD CONSTRAINT "product_submissions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founding_members" ADD CONSTRAINT "founding_members_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_memberships" ADD CONSTRAINT "loyalty_memberships_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tiers" ADD CONSTRAINT "loyalty_tiers_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
