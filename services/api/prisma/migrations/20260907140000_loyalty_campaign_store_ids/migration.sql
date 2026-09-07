-- Store-scoped loyalty bonus campaigns (empty storeIds = global / all stores)
ALTER TABLE "loyalty_bonus_campaigns" ADD COLUMN IF NOT EXISTS "storeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
