-- CreateEnum: VendorStatus (safe — IF NOT EXISTS)
DO $$ BEGIN CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'DEACTIVATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum: VendorProductStatus
DO $$ BEGIN CREATE TYPE "VendorProductStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum: LedgerEntryType
DO $$ BEGIN CREATE TYPE "LedgerEntryType" AS ENUM ('SALE', 'COMMISSION', 'REFUND', 'PAYOUT', 'ADJUSTMENT', 'SUBSCRIPTION_FEE', 'CHARGEBACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: orders — add parent/child order support, shipping/discount amounts, Stripe fields
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "parentOrderId" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "rejectionReason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "stripePaymentIntentId" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "platformFeeAmount" DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN "stripeTaxAmount" DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- AlterTable: orders — update currency default from GBP to USD
DO $$ BEGIN ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- AlterTable: sellers — add vendor management and Stripe Connect fields
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "vendorStatus" "VendorStatus" NOT NULL DEFAULT 'PENDING'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "monthlySubscriptionFee" DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "subscriptionPlan" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "applicationNotes" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "approvedAt" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "approvedBy" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "stripeConnectAccountId" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sellers" ADD COLUMN "taxId" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- AlterTable: Update currency defaults from GBP to USD across tables
DO $$ BEGIN ALTER TABLE "users" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "customers" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "currency_exchange_rates" ALTER COLUMN "baseCurrency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "gift_cards" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "influencer_commissions" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "influencer_payouts" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- CreateTable: vendor_products
CREATE TABLE IF NOT EXISTS "vendor_products" (
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
CREATE TABLE IF NOT EXISTS "vendor_ledger_entries" (
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

-- CreateIndex (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_products_sellerId_productId_key" ON "vendor_products"("sellerId", "productId");
CREATE INDEX IF NOT EXISTS "vendor_products_sellerId_idx" ON "vendor_products"("sellerId");
CREATE INDEX IF NOT EXISTS "vendor_products_productId_idx" ON "vendor_products"("productId");
CREATE INDEX IF NOT EXISTS "vendor_products_status_idx" ON "vendor_products"("status");
CREATE INDEX IF NOT EXISTS "vendor_products_sellerId_status_idx" ON "vendor_products"("sellerId", "status");

CREATE INDEX IF NOT EXISTS "vendor_ledger_entries_sellerId_idx" ON "vendor_ledger_entries"("sellerId");
CREATE INDEX IF NOT EXISTS "vendor_ledger_entries_orderId_idx" ON "vendor_ledger_entries"("orderId");
CREATE INDEX IF NOT EXISTS "vendor_ledger_entries_type_idx" ON "vendor_ledger_entries"("type");
CREATE INDEX IF NOT EXISTS "vendor_ledger_entries_createdAt_idx" ON "vendor_ledger_entries"("createdAt");
CREATE INDEX IF NOT EXISTS "vendor_ledger_entries_sellerId_createdAt_idx" ON "vendor_ledger_entries"("sellerId", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_parentOrderId_idx" ON "orders"("parentOrderId");

CREATE INDEX IF NOT EXISTS "sellers_vendorStatus_idx" ON "sellers"("vendorStatus");
DO $$ BEGIN CREATE UNIQUE INDEX "sellers_stripeConnectAccountId_key" ON "sellers"("stripeConnectAccountId"); EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- AddForeignKey (safe)
DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migrate existing sellers
DO $$ BEGIN UPDATE "sellers" SET "vendorStatus" = 'ACTIVE' WHERE "verified" = true; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN UPDATE "sellers" SET "vendorStatus" = 'PENDING' WHERE "verified" = false; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SALES';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Transaction default currency to USD
DO $$ BEGIN ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
