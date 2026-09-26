-- CreateTable
CREATE TABLE "admin_email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "templateSlug" TEXT,
    "audienceType" TEXT NOT NULL,
    "audienceQuery" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentBy" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_email_campaigns_sentBy_idx" ON "admin_email_campaigns"("sentBy");

-- CreateIndex
CREATE INDEX "admin_email_campaigns_status_idx" ON "admin_email_campaigns"("status");

-- CreateIndex
CREATE INDEX "admin_email_campaigns_createdAt_idx" ON "admin_email_campaigns"("createdAt");
