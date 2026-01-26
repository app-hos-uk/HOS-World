-- Add role-specific profile fields

-- User: Marketing dates and team member fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anniversary" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- Add foreign key for manager relationship (self-referencing)
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" 
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Customer: B2B/Wholesaler fields
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "businessRegNumber" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "businessType" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "creditTerms" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billingAddressId" TEXT;

-- Seller: Business compliance and bank details
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "legalBusinessName" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "accountHolder" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "accountNumberEnc" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "sortCodeEnc" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "warehouseAddressId" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "opsContactName" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "opsContactEmail" TEXT;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "opsContactPhone" TEXT;
