-- Backfill status for founding members who were already sent account invitations
-- but whose status column was never updated from REGISTERED to INVITED.
-- Guard: table is created later (20261003000000) — no-op on fresh databases.
DO $$
BEGIN
  IF to_regclass('public.founding_members') IS NOT NULL THEN
    UPDATE "founding_members"
    SET    "status" = 'INVITED',
           "updatedAt" = NOW()
    WHERE  "userId" IS NULL
      AND  "metadata"::text LIKE '%accountInvitationSentAt%'
      AND  "metadata"::text NOT LIKE '%"accountInvitationSentAt":null%'
      AND  "status" = 'REGISTERED';
  END IF;
END $$;
