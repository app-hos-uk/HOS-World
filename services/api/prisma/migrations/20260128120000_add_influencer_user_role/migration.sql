-- Add INFLUENCER to UserRole enum if not present (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'INFLUENCER'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'INFLUENCER';
  END IF;
END
$$;
