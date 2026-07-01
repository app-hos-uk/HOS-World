-- CreateEnum
CREATE TYPE "VerificationDocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "seller_verification_documents" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "VerificationDocStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_verification_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seller_verification_documents_sellerId_idx" ON "seller_verification_documents"("sellerId");
CREATE INDEX IF NOT EXISTS "seller_verification_documents_status_idx" ON "seller_verification_documents"("status");

ALTER TABLE "seller_verification_documents" ADD CONSTRAINT "seller_verification_documents_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
