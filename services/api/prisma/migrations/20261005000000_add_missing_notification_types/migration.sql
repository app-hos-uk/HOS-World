-- Add NotificationType enum values that the application already references
-- (present in VALID_NOTIFICATION_TYPES) but were missing from the DB enum.
-- Idempotent so it is safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORDER_REFUNDED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORDER_REFUNDED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'SETTLEMENT_COMPLETED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SETTLEMENT_COMPLETED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'PRODUCT_APPROVED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_APPROVED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'PRODUCT_REJECTED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_REJECTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'SYSTEM') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'GENERAL') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GENERAL';
  END IF;
END $$;
