-- Allow ReturnRequest / ReturnItem to originate from a POS sale as well as an online order.
-- Existing online returns keep their orderId / orderItemId values; those columns become nullable.

-- ---------------------------------------------------------------------------
-- return_requests: nullable orderId + POS sale FK
-- ---------------------------------------------------------------------------
ALTER TABLE "return_requests" ALTER COLUMN "orderId" DROP NOT NULL;

ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "posSaleId" TEXT;

CREATE INDEX IF NOT EXISTS "return_requests_orderId_idx" ON "return_requests"("orderId");
CREATE INDEX IF NOT EXISTS "return_requests_posSaleId_idx" ON "return_requests"("posSaleId");

DO $$
BEGIN
  ALTER TABLE "return_requests"
    ADD CONSTRAINT "return_requests_posSaleId_fkey"
    FOREIGN KEY ("posSaleId") REFERENCES "pos_sales"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- return_items: nullable orderItemId + POS sale item FK
-- ---------------------------------------------------------------------------
ALTER TABLE "return_items" ALTER COLUMN "orderItemId" DROP NOT NULL;

ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "posSaleItemId" TEXT;

CREATE INDEX IF NOT EXISTS "return_items_posSaleItemId_idx" ON "return_items"("posSaleItemId");

DO $$
BEGIN
  ALTER TABLE "return_items"
    ADD CONSTRAINT "return_items_posSaleItemId_fkey"
    FOREIGN KEY ("posSaleItemId") REFERENCES "pos_sale_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
