-- AlterTable
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "carts_guestSessionId_key" ON "carts"("guestSessionId");
