-- Per-option minimum cart value threshold for loyalty redemption options
ALTER TABLE "loyalty_redemption_options"
  ADD COLUMN IF NOT EXISTS "minCartValue" DECIMAL(10, 2);
