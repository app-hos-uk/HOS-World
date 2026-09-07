-- Qualifying merchandise subtotal (gift cards excluded) for loyalty campaign thresholds.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "qualifyingSubtotal" DECIMAL(10,2);
