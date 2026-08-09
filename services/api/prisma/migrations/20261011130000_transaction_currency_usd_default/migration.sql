-- Transaction.currency was left on a GBP default by the US region normalisation migration.
-- It was missed because "Transaction" is the one PascalCase table in an otherwise snake_case
-- schema, so it fell outside the pattern used to enumerate currency columns.
--
-- Relabel only: no monetary amount is altered.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Transaction' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "Transaction" ALTER COLUMN "currency" SET DEFAULT 'USD';
    UPDATE "Transaction" SET "currency" = 'USD' WHERE "currency" = 'GBP';
  END IF;
END $$;

-- Fail closed, consistent with the preceding normalisation migration.
DO $$
DECLARE
  remaining BIGINT := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Transaction' AND column_name = 'currency'
  ) THEN
    SELECT COUNT(*) INTO remaining FROM "Transaction" WHERE "currency" = 'GBP';
  END IF;

  IF remaining > 0 THEN
    RAISE EXCEPTION
      'Transaction currency normalisation incomplete: % residual GBP row(s) remain',
      remaining;
  END IF;
END $$;
