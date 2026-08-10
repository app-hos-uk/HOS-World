-- Add STORE_STAFF to UserRole enum if not present (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'STORE_STAFF'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'STORE_STAFF';
  END IF;
END
$$;

-- Optional store assignment for store staff users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_storeId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "users_storeId_idx" ON "users"("storeId");
