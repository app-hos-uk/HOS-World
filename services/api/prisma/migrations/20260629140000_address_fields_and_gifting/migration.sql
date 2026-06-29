-- Add new fields to addresses table
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "landmark" TEXT;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "deliveryInstructions" TEXT;

-- Add gifting support to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isGift" BOOLEAN NOT NULL DEFAULT false;

-- Create gift_details table
CREATE TABLE IF NOT EXISTS "gift_details" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "giftMessage" TEXT,
    "giftWrapping" BOOLEAN NOT NULL DEFAULT false,
    "hidePrice" BOOLEAN NOT NULL DEFAULT true,
    "senderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gift_details_orderId_key" ON "gift_details"("orderId");

ALTER TABLE "gift_details"
  ADD CONSTRAINT "gift_details_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
