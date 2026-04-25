-- AlterTable
ALTER TABLE "click_collect_orders" ADD COLUMN IF NOT EXISTS "ccLoyaltyBonusApplied" BOOLEAN NOT NULL DEFAULT false;
