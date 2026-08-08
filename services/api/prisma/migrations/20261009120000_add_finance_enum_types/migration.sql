-- The finance tables (reconciliation, disputes, financial periods) were created with
-- TEXT status columns, but schema.prisma declares them as native Postgres enums. Prisma
-- therefore casts to types that were never created, so every read/write against these
-- columns fails with `type "public.<Enum>" does not exist`.
-- This migration creates the missing types and converts the existing columns in place.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReconciliationStatus') THEN
    CREATE TYPE "ReconciliationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReconciliationItemType') THEN
    CREATE TYPE "ReconciliationItemType" AS ENUM ('MATCHED', 'AMOUNT_MISMATCH', 'MISSING_INTERNAL', 'MISSING_STRIPE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReconciliationItemStatus') THEN
    CREATE TYPE "ReconciliationItemStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'IGNORED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeStatus') THEN
    CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'WON', 'LOST', 'CLOSED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialPeriodStatus') THEN
    CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');
  END IF;
END
$$;

-- reconciliation_runs.status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reconciliation_runs' AND column_name = 'status' AND data_type = 'text'
  ) THEN
    UPDATE "reconciliation_runs"
      SET "status" = 'RUNNING'
      WHERE "status" IS NULL OR "status" NOT IN ('RUNNING', 'COMPLETED', 'FAILED');
    ALTER TABLE "reconciliation_runs" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "reconciliation_runs"
      ALTER COLUMN "status" TYPE "ReconciliationStatus" USING "status"::"ReconciliationStatus";
    ALTER TABLE "reconciliation_runs" ALTER COLUMN "status" SET DEFAULT 'RUNNING';
  END IF;
END
$$;

-- reconciliation_items.type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reconciliation_items' AND column_name = 'type' AND data_type = 'text'
  ) THEN
    UPDATE "reconciliation_items"
      SET "type" = 'MATCHED'
      WHERE "type" IS NULL OR "type" NOT IN ('MATCHED', 'AMOUNT_MISMATCH', 'MISSING_INTERNAL', 'MISSING_STRIPE');
    ALTER TABLE "reconciliation_items"
      ALTER COLUMN "type" TYPE "ReconciliationItemType" USING "type"::"ReconciliationItemType";
  END IF;
END
$$;

-- reconciliation_items.status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reconciliation_items' AND column_name = 'status' AND data_type = 'text'
  ) THEN
    UPDATE "reconciliation_items"
      SET "status" = 'UNRESOLVED'
      WHERE "status" IS NULL OR "status" NOT IN ('UNRESOLVED', 'RESOLVED', 'IGNORED');
    ALTER TABLE "reconciliation_items" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "reconciliation_items"
      ALTER COLUMN "status" TYPE "ReconciliationItemStatus" USING "status"::"ReconciliationItemStatus";
    ALTER TABLE "reconciliation_items" ALTER COLUMN "status" SET DEFAULT 'UNRESOLVED';
  END IF;
END
$$;

-- disputes.status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disputes' AND column_name = 'status' AND data_type = 'text'
  ) THEN
    UPDATE "disputes"
      SET "status" = 'OPEN'
      WHERE "status" IS NULL OR "status" NOT IN ('OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'WON', 'LOST', 'CLOSED');
    ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "disputes"
      ALTER COLUMN "status" TYPE "DisputeStatus" USING "status"::"DisputeStatus";
    ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'OPEN';
  END IF;
END
$$;

-- financial_periods.status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_periods' AND column_name = 'status' AND data_type = 'text'
  ) THEN
    UPDATE "financial_periods"
      SET "status" = 'OPEN'
      WHERE "status" IS NULL OR "status" NOT IN ('OPEN', 'CLOSING', 'CLOSED');
    ALTER TABLE "financial_periods" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "financial_periods"
      ALTER COLUMN "status" TYPE "FinancialPeriodStatus" USING "status"::"FinancialPeriodStatus";
    ALTER TABLE "financial_periods" ALTER COLUMN "status" SET DEFAULT 'OPEN';
  END IF;
END
$$;
