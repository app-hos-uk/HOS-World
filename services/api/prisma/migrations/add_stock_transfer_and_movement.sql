-- Migration: Add StockTransfer and StockMovement models
-- Date: 2025-01-XX
-- Description: Adds multi-warehouse inventory tracking with transfers and movement audit trail

-- Create enum for TransferStatus
DO $$ BEGIN
  CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for MovementType
DO $$ BEGIN
  CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUST', 'RESERVE', 'RELEASE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create StockTransfer table
CREATE TABLE IF NOT EXISTS "stock_transfers" (
  "id" TEXT NOT NULL,
  "fromWarehouseId" TEXT NOT NULL,
  "toWarehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT NOT NULL,
  "completedBy" TEXT,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- Create StockMovement table
CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" TEXT NOT NULL,
  "inventoryLocationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "movementType" "MovementType" NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "performedBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- Create indexes for StockTransfer
CREATE INDEX IF NOT EXISTS "stock_transfers_fromWarehouseId_idx" ON "stock_transfers"("fromWarehouseId");
CREATE INDEX IF NOT EXISTS "stock_transfers_toWarehouseId_idx" ON "stock_transfers"("toWarehouseId");
CREATE INDEX IF NOT EXISTS "stock_transfers_productId_idx" ON "stock_transfers"("productId");
CREATE INDEX IF NOT EXISTS "stock_transfers_status_idx" ON "stock_transfers"("status");
CREATE INDEX IF NOT EXISTS "stock_transfers_requestedBy_idx" ON "stock_transfers"("requestedBy");

-- Create indexes for StockMovement
CREATE INDEX IF NOT EXISTS "stock_movements_inventoryLocationId_idx" ON "stock_movements"("inventoryLocationId");
CREATE INDEX IF NOT EXISTS "stock_movements_productId_idx" ON "stock_movements"("productId");
CREATE INDEX IF NOT EXISTS "stock_movements_movementType_idx" ON "stock_movements"("movementType");
CREATE INDEX IF NOT EXISTS "stock_movements_reference_idx" ON "stock_movements"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
