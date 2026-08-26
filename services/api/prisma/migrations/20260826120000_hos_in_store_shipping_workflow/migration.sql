-- HoS in-store shipping workflow: box sizes, shipment groups, order numbers.

ALTER TABLE "store_shipment_requests" ALTER COLUMN "status" SET DEFAULT 'NEW';

ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "hosOrderNumber" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "qrAccessCode" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "selectedItems" JSONB;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "totalCustomerCharge" DECIMAL(10,2);
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "totalCarrierCost" DECIMAL(10,2);
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "totalPackagingCost" DECIMAL(10,2);
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "shippingSlipUrl" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "specialInstructions" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "receivedByEmployee" TEXT;
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "store_shipment_requests_hosOrderNumber_key" ON "store_shipment_requests"("hosOrderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "store_shipment_requests_qrAccessCode_key" ON "store_shipment_requests"("qrAccessCode");
CREATE INDEX IF NOT EXISTS "store_shipment_requests_hosOrderNumber_idx" ON "store_shipment_requests"("hosOrderNumber");

CREATE TABLE IF NOT EXISTS "box_sizes" (
  "id" TEXT NOT NULL,
  "storeId" TEXT,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "lengthCm" DECIMAL(10,2) NOT NULL,
  "widthCm" DECIMAL(10,2) NOT NULL,
  "heightCm" DECIMAL(10,2) NOT NULL,
  "customerPrice" DECIMAL(10,2) NOT NULL,
  "packagingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "box_sizes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "box_sizes_storeId_idx" ON "box_sizes"("storeId");
CREATE INDEX IF NOT EXISTS "box_sizes_isActive_idx" ON "box_sizes"("isActive");

ALTER TABLE "box_sizes" ADD CONSTRAINT "box_sizes_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "shipment_groups" (
  "id" TEXT NOT NULL,
  "shippingOrderId" TEXT NOT NULL,
  "destinationAddressId" TEXT,
  "destinationSnapshot" JSONB,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "recipientPhone" TEXT,
  "boxSizeId" TEXT,
  "boxSizeName" TEXT,
  "customerPrice" DECIMAL(10,2),
  "packagingCost" DECIMAL(10,2),
  "actualWeightKg" DECIMAL(10,3),
  "actualLengthCm" DECIMAL(10,2),
  "actualWidthCm" DECIMAL(10,2),
  "actualHeightCm" DECIMAL(10,2),
  "shippoTransactionId" TEXT,
  "trackingCode" TEXT,
  "labelUrl" TEXT,
  "carrierName" TEXT,
  "carrierService" TEXT,
  "carrierCost" DECIMAL(10,2),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "packedBy" TEXT,
  "packedAt" TIMESTAMP(3),
  "labelCreatedAt" TIMESTAMP(3),
  "handedToCarrierAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipment_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shipment_groups_shippingOrderId_idx" ON "shipment_groups"("shippingOrderId");
CREATE INDEX IF NOT EXISTS "shipment_groups_status_idx" ON "shipment_groups"("status");
CREATE INDEX IF NOT EXISTS "shipment_groups_boxSizeId_idx" ON "shipment_groups"("boxSizeId");

ALTER TABLE "shipment_groups" ADD CONSTRAINT "shipment_groups_shippingOrderId_fkey"
  FOREIGN KEY ("shippingOrderId") REFERENCES "store_shipment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_groups" ADD CONSTRAINT "shipment_groups_boxSizeId_fkey"
  FOREIGN KEY ("boxSizeId") REFERENCES "box_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "shipment_group_items" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "posSaleItemId" TEXT,
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipment_group_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shipment_group_items_groupId_idx" ON "shipment_group_items"("groupId");
CREATE INDEX IF NOT EXISTS "shipment_group_items_posSaleItemId_idx" ON "shipment_group_items"("posSaleItemId");

ALTER TABLE "shipment_group_items" ADD CONSTRAINT "shipment_group_items_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "shipment_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
