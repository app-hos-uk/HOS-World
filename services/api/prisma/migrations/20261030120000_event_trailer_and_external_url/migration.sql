-- Trailer and convention link fields for landing-page events.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "trailerUrl" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
