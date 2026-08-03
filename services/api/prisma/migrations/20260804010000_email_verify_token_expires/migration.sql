-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifyTokenExpires" TIMESTAMP(3);
