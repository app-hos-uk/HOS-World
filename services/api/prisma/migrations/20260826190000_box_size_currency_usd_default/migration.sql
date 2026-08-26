-- Customer shipping is quoted from the box size × destination tier matrix, and every
-- ShippingRateTier is seeded in USD. The box_sizes default of 'GBP' therefore disagreed
-- with the tier currency for any box created without an explicit currency.
ALTER TABLE "box_sizes" ALTER COLUMN "currency" SET DEFAULT 'USD';
