-- Make orders.sellerId nullable
-- The Prisma schema defines sellerId as String? (optional) on the Order model,
-- but the database column was created with NOT NULL. Platform-owned products
-- have no seller, so sellerId must be nullable for orders containing such products.

DO $$
BEGIN
    -- Check if the column exists and is NOT NULL before trying to alter it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'sellerId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "orders" ALTER COLUMN "sellerId" DROP NOT NULL;
        RAISE NOTICE 'orders.sellerId: dropped NOT NULL constraint';
    ELSE
        RAISE NOTICE 'orders.sellerId: already nullable or does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error altering orders.sellerId column: %', SQLERRM;
END $$;
