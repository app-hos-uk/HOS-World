-- AlterEnum (append new notification type)
ALTER TYPE "NotificationType" ADD VALUE 'CART_ABANDONED';

-- AlterTable
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "abandonedEmailSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "promotionFreeShipping" BOOLEAN NOT NULL DEFAULT false;
