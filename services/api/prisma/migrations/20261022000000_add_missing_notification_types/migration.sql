-- Add notification types that were whitelisted in application code but missing
-- from the database enum, causing prisma.notification.create() to reject them.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOW_STOCK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OUT_OF_STOCK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_ORDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETURN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETURN_COMPLETED';
