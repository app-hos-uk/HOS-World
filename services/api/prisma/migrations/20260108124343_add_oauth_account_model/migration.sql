-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_accounts_provider_idx" ON "oauth_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_providerId_key" ON "oauth_accounts"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Make password optional (if not already nullable)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'password' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
    END IF;
END $$;
