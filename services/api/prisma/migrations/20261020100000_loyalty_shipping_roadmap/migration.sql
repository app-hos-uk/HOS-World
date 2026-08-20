-- Loyalty POS voucher audit fields + GiftCard external bridge
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "ttlExpiresAt" TIMESTAMP(3);
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "staffUserId" TEXT;
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "issuedByUserId" TEXT;
ALTER TABLE "loyalty_pos_vouchers" ADD COLUMN IF NOT EXISTS "terminalId" TEXT;

CREATE INDEX IF NOT EXISTS "loyalty_pos_vouchers_ttlExpiresAt_idx" ON "loyalty_pos_vouchers"("ttlExpiresAt");

ALTER TABLE "loyalty_pos_vouchers" ADD CONSTRAINT "loyalty_pos_vouchers_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loyalty_pos_vouchers" ADD CONSTRAINT "loyalty_pos_vouchers_issuedByUserId_fkey"
  FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gift_cards" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'HOS';
ALTER TABLE "gift_cards" ADD COLUMN IF NOT EXISTS "balanceSource" TEXT NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "gift_cards" ADD COLUMN IF NOT EXISTS "posVoucherId" TEXT;
ALTER TABLE "gift_cards" ADD COLUMN IF NOT EXISTS "externalClientId" TEXT;
ALTER TABLE "gift_cards" ADD COLUMN IF NOT EXISTS "externalTransactionId" TEXT;
ALTER TABLE "gift_cards" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_posVoucherId_key" ON "gift_cards"("posVoucherId");
CREATE INDEX IF NOT EXISTS "gift_cards_source_idx" ON "gift_cards"("source");

ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_posVoucherId_fkey"
  FOREIGN KEY ("posVoucherId") REFERENCES "loyalty_pos_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "loyalty_pos_redeem_otps" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_pos_redeem_otps_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "loyalty_pos_redeem_otps" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "loyalty_pos_redeem_otps_membershipId_storeId_idx"
  ON "loyalty_pos_redeem_otps"("membershipId", "storeId");
CREATE INDEX IF NOT EXISTS "loyalty_pos_redeem_otps_expiresAt_idx" ON "loyalty_pos_redeem_otps"("expiresAt");

-- GDPR till consent before account exists
ALTER TABLE "gdpr_consent_logs" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "gdpr_consent_logs" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "gdpr_consent_logs" ADD COLUMN IF NOT EXISTS "consentSource" TEXT;

CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_email_idx" ON "gdpr_consent_logs"("email");
CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_userId_idx" ON "gdpr_consent_logs"("userId");

-- Store shipment (B1)
CREATE TABLE IF NOT EXISTS "store_shipment_requests" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "storeId" TEXT NOT NULL,
  "userId" TEXT,
  "posSaleId" TEXT,
  "posExternalSaleId" TEXT,
  "invoiceNumber" TEXT,
  "claimEmail" TEXT,
  "claimTokenHash" TEXT,
  "claimTokenExpiresAt" TIMESTAMP(3),
  "destinationAddressId" TEXT,
  "shippingAmount" DECIMAL(10,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "stripePaymentIntentId" TEXT,
  "selectedCarrier" TEXT,
  "selectedService" TEXT,
  "trackingCode" TEXT,
  "labelUrl" TEXT,
  "shippingCost" DECIMAL(10,2),
  "customsSnapshot" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_shipment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_shipment_requests_claimTokenHash_key"
  ON "store_shipment_requests"("claimTokenHash");
CREATE INDEX IF NOT EXISTS "store_shipment_requests_storeId_idx" ON "store_shipment_requests"("storeId");
CREATE INDEX IF NOT EXISTS "store_shipment_requests_userId_idx" ON "store_shipment_requests"("userId");
CREATE INDEX IF NOT EXISTS "store_shipment_requests_status_idx" ON "store_shipment_requests"("status");
CREATE INDEX IF NOT EXISTS "store_shipment_requests_invoiceNumber_idx" ON "store_shipment_requests"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "store_shipment_requests_claimEmail_idx" ON "store_shipment_requests"("claimEmail");

ALTER TABLE "store_shipment_requests" ADD CONSTRAINT "store_shipment_requests_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "store_shipment_requests" ADD CONSTRAINT "store_shipment_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "store_shipment_requests" ADD CONSTRAINT "store_shipment_requests_posSaleId_fkey"
  FOREIGN KEY ("posSaleId") REFERENCES "pos_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "store_shipment_requests" ADD CONSTRAINT "store_shipment_requests_destinationAddressId_fkey"
  FOREIGN KEY ("destinationAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sku_customs_attributes" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "productId" TEXT,
  "hsCode" TEXT,
  "countryOfOrigin" TEXT,
  "weightKg" DECIMAL(10,3),
  "lengthCm" DECIMAL(10,2),
  "widthCm" DECIMAL(10,2),
  "heightCm" DECIMAL(10,2),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sku_customs_attributes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sku_customs_attributes_sku_key" ON "sku_customs_attributes"("sku");
CREATE INDEX IF NOT EXISTS "sku_customs_attributes_status_idx" ON "sku_customs_attributes"("status");
CREATE INDEX IF NOT EXISTS "sku_customs_attributes_productId_idx" ON "sku_customs_attributes"("productId");

ALTER TABLE "sku_customs_attributes" ADD CONSTRAINT "sku_customs_attributes_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "pos_sales_customerEmail_idx" ON "pos_sales"("customerEmail");
CREATE INDEX IF NOT EXISTS "pos_sales_externalInvoice_idx" ON "pos_sales"("externalInvoice");
