-- CreateTable: Integration Configuration for third-party API credentials
CREATE TABLE IF NOT EXISTS "integration_configs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "credentials" TEXT NOT NULL,
    "settings" JSONB,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "testStatus" TEXT,
    "testMessage" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Integration Logs for tracking API calls and events
CREATE TABLE IF NOT EXISTS "integration_logs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "duration" INTEGER,
    "requestSummary" TEXT,
    "responseSummary" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on category + provider
CREATE UNIQUE INDEX IF NOT EXISTS "integration_configs_category_provider_key" ON "integration_configs"("category", "provider");

-- CreateIndex: Category index for filtering
CREATE INDEX IF NOT EXISTS "integration_configs_category_idx" ON "integration_configs"("category");

-- CreateIndex: Active status index
CREATE INDEX IF NOT EXISTS "integration_configs_isActive_idx" ON "integration_configs"("isActive");

-- CreateIndex: Provider index
CREATE INDEX IF NOT EXISTS "integration_configs_provider_idx" ON "integration_configs"("provider");

-- CreateIndex: Integration ID index for logs
CREATE INDEX IF NOT EXISTS "integration_logs_integrationId_idx" ON "integration_logs"("integrationId");

-- CreateIndex: CreatedAt index for log queries
CREATE INDEX IF NOT EXISTS "integration_logs_createdAt_idx" ON "integration_logs"("createdAt");

-- CreateIndex: Provider index for logs
CREATE INDEX IF NOT EXISTS "integration_logs_provider_idx" ON "integration_logs"("provider");

-- CreateIndex: Action index for logs
CREATE INDEX IF NOT EXISTS "integration_logs_action_idx" ON "integration_logs"("action");

-- AddForeignKey: Link logs to integration configs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_logs_integrationId_fkey') THEN
    ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integration_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
