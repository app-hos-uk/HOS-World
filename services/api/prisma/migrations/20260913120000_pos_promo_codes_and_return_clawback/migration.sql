-- POS loyalty: Lightspeed promo-code redemptions + return-sale clawback link.

ALTER TABLE "pos_sales" ADD COLUMN IF NOT EXISTS "returnForExternalSaleId" TEXT;

CREATE INDEX IF NOT EXISTS "pos_sales_returnForExternalSaleId_idx"
  ON "pos_sales"("returnForExternalSaleId");

ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'GIFT_CARD';
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "promoCode" TEXT;
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "externalPromotionId" TEXT;

CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_type_idx"
  ON "loyalty_pos_vouchers"("type");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_promoCode_idx"
  ON "loyalty_pos_vouchers"("promoCode");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_externalPromotionId_idx"
  ON "loyalty_pos_vouchers"("externalPromotionId");
