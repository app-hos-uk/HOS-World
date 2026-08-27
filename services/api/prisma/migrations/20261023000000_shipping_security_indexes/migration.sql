-- Security & scalability: composite indexes for dashboard and list queries
CREATE INDEX IF NOT EXISTS "store_shipment_requests_createdAt_idx"
  ON "store_shipment_requests" ("createdAt");

CREATE INDEX IF NOT EXISTS "store_shipment_requests_storeId_status_createdAt_idx"
  ON "store_shipment_requests" ("storeId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "store_shipment_requests_status_createdAt_idx"
  ON "store_shipment_requests" ("status", "createdAt");
