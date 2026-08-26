-- Staff-confirmed counter payment (cash / standalone card machine / other).
-- Not Lightspeed POS and not Stripe unless SHIPPING_ONLINE_PAYMENT is enabled.
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
