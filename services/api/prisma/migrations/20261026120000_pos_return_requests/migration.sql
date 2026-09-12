-- AlterTable: add trackingUrl to StoreShipmentRequest and ShipmentGroup
ALTER TABLE "store_shipment_requests" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "shipment_groups" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
