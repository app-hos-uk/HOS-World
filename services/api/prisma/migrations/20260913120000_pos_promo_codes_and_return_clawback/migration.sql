-- POS loyalty: Lightspeed promo-code redemptions + return-sale clawback link.

ALTER TABLE "pos_sales" ADD COLUMN IF NOT EXISTS "returnForExternalSaleId" TEXT;

CREATE INDEX IF NOT EXISTS "pos_sales_returnForExternalSaleId_idx"
  ON "pos_sales"("returnForExternalSaleId");

-- Ensure base table exists (created later in 20261008… but ALTER needs it now).
CREATE TABLE IF NOT EXISTS "loyalty_pos_vouchers" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "clientId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_pos_vouchers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'GIFT_CARD';
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "promoCode" TEXT;
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "externalPromotionId" TEXT;

CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_type_idx"
  ON "loyalty_pos_vouchers"("type");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_promoCode_idx"
  ON "loyalty_pos_vouchers"("promoCode");
CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_externalPromotionId_idx"
  ON "loyalty_pos_vouchers"("externalPromotionId");
