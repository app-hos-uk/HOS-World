-- CreateEnum: VendorStatus
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'DEACTIVATED');

-- CreateEnum: VendorProductStatus
CREATE TYPE "VendorProductStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');

-- CreateEnum: LedgerEntryType
CREATE TYPE "LedgerEntryType" AS ENUM ('SALE', 'COMMISSION', 'REFUND', 'PAYOUT', 'ADJUSTMENT', 'SUBSCRIPTION_FEE', 'CHARGEBACK');

-- AlterTable: orders — add parent/child order support, shipping/discount amounts, Stripe fields
ALTER TABLE "orders" ADD COLUMN "parentOrderId" TEXT;
ALTER TABLE "orders" ADD COLUMN "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "orders" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "orders" ADD COLUMN "platformFeeAmount" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN "stripeTaxAmount" DECIMAL(10,2);

-- AlterTable: orders — update currency default from GBP to USD
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable: sellers — add vendor management and Stripe Connect fields
ALTER TABLE "sellers" ADD COLUMN "vendorStatus" "VendorStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "sellers" ADD COLUMN "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10;
ALTER TABLE "sellers" ADD COLUMN "monthlySubscriptionFee" DECIMAL(10,2);
ALTER TABLE "sellers" ADD COLUMN "subscriptionPlan" TEXT;
ALTER TABLE "sellers" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "sellers" ADD COLUMN "applicationNotes" TEXT;
ALTER TABLE "sellers" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "sellers" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "sellers" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "sellers" ADD COLUMN "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sellers" ADD COLUMN "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sellers" ADD COLUMN "taxId" TEXT;

-- AlterTable: Update currency defaults from GBP to USD across tables
ALTER TABLE "users" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
ALTER TABLE "customers" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "currency_exchange_rates" ALTER COLUMN "baseCurrency" SET DEFAULT 'USD';
ALTER TABLE "gift_cards" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "influencer_commissions" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "influencer_payouts" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- CreateTable: vendor_products
CREATE TABLE "vendor_products" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "VendorProductStatus" NOT NULL DEFAULT 'DRAFT',
    "vendorPrice" DECIMAL(10,2) NOT NULL,
    "vendorCurrency" TEXT NOT NULL DEFAULT 'USD',
    "platformPrice" DECIMAL(10,2),
    "costPrice" DECIMAL(10,2),
    "marginPercent" DECIMAL(5,4),
    "vendorStock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
    "fulfillmentMethod" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 3,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "totalUnitsSold" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_ledger_entries
CREATE TABLE "vendor_ledger_entries" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: vendor_products
CREATE UNIQUE INDEX "vendor_products_sellerId_productId_key" ON "vendor_products"("sellerId", "productId");
CREATE INDEX "vendor_products_sellerId_idx" ON "vendor_products"("sellerId");
CREATE INDEX "vendor_products_productId_idx" ON "vendor_products"("productId");
CREATE INDEX "vendor_products_status_idx" ON "vendor_products"("status");
CREATE INDEX "vendor_products_sellerId_status_idx" ON "vendor_products"("sellerId", "status");

-- CreateIndex: vendor_ledger_entries
CREATE INDEX "vendor_ledger_entries_sellerId_idx" ON "vendor_ledger_entries"("sellerId");
CREATE INDEX "vendor_ledger_entries_orderId_idx" ON "vendor_ledger_entries"("orderId");
CREATE INDEX "vendor_ledger_entries_type_idx" ON "vendor_ledger_entries"("type");
CREATE INDEX "vendor_ledger_entries_createdAt_idx" ON "vendor_ledger_entries"("createdAt");
CREATE INDEX "vendor_ledger_entries_sellerId_createdAt_idx" ON "vendor_ledger_entries"("sellerId", "createdAt");

-- CreateIndex: orders parentOrderId
CREATE INDEX "orders_parentOrderId_idx" ON "orders"("parentOrderId");

-- CreateIndex: sellers vendorStatus and stripeConnectAccountId
CREATE INDEX "sellers_vendorStatus_idx" ON "sellers"("vendorStatus");
CREATE UNIQUE INDEX "sellers_stripeConnectAccountId_key" ON "sellers"("stripeConnectAccountId");

-- AddForeignKey: orders parent/child self-relation
ALTER TABLE "orders" ADD CONSTRAINT "orders_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: vendor_products → sellers
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: vendor_products → products
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: vendor_ledger_entries → sellers
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: vendor_ledger_entries → orders
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing sellers: set verified sellers to ACTIVE, unverified to PENDING
UPDATE "sellers" SET "vendorStatus" = 'ACTIVE' WHERE "verified" = true;
UPDATE "sellers" SET "vendorStatus" = 'PENDING' WHERE "verified" = false;

-- Add SALES role to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SALES';

-- Add ACCEPTED and REJECTED to OrderStatus enum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED' AFTER 'PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED' AFTER 'ACCEPTED';

-- Transaction default currency to USD
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD';
