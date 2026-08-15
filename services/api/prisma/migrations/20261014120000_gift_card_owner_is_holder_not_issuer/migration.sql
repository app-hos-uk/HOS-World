-- Gift cards previously stored the issuing admin in "userId" whenever no
-- recipient email was supplied, conflating "who created the card" with "who may
-- spend it". Redemption now enforces that a card with an owner belongs to that
-- owner, which would leave every admin-issued bearer card redeemable only by
-- the admin who created it.
--
-- Under the old create path "userId" was only set to the issuer when
-- "issuedToEmail" was null; a card issued to a named recipient either resolved
-- to that recipient's account or stayed null. So a row with no recipient email
-- and a non-null owner is an issuer stamp, and clearing it restores the card to
-- the bearer instrument it was meant to be. Cards already claimed by a redeemer
-- are unaffected, because those were all created with a recipient email.

UPDATE "gift_cards"
SET "userId" = NULL
WHERE "issuedToEmail" IS NULL
  AND "userId" IS NOT NULL;
