-- Actual carrier label cost and label URL (Shippo / courier integrations).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(10, 2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingLabelUrl" TEXT;
