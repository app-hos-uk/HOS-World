-- Minimum shipping charge floor for calculated rates (e.g. weight-based)
ALTER TABLE "shipping_rules"
ADD COLUMN IF NOT EXISTS "minimumCharge" DECIMAL(10,2);
