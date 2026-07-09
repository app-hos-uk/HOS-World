-- Backfill status for founding members who were already sent account invitations
-- but whose status column was never updated from REGISTERED to INVITED.
UPDATE "founding_members"
SET    "status" = 'INVITED',
       "updatedAt" = NOW()
WHERE  "userId" IS NULL
  AND  "metadata"::text LIKE '%accountInvitationSentAt%'
  AND  "metadata"::text NOT LIKE '%"accountInvitationSentAt":null%'
  AND  "status" = 'REGISTERED';
