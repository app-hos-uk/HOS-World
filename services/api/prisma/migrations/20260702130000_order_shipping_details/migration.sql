-- Seller-entered outbound shipping details on customer orders.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimatedDeliveryAt" TIMESTAMP(3);
