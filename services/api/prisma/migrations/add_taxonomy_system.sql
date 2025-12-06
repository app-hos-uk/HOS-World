-- Migration: Add Product Taxonomy System (Categories, Attributes, Tags)
-- This migration adds the complete taxonomy system for products with hierarchical categories,
-- global and category-specific attributes, and enhanced tagging

-- 0. Create all enum types first (before tables that use them)
DO $$ BEGIN
    CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN', 'DATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TagCategory" AS ENUM ('THEME', 'OCCASION', 'STYLE', 'CHARACTER', 'FANDOM', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Categories Table (3-level hierarchy)
CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "categories_parentId_idx" ON "categories"("parentId");
CREATE INDEX IF NOT EXISTS "categories_level_idx" ON "categories"("level");
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories"("slug");

-- 2. Attributes Table
CREATE TABLE IF NOT EXISTS "attributes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attributes_slug_key" ON "attributes"("slug");
CREATE INDEX IF NOT EXISTS "attributes_categoryId_idx" ON "attributes"("categoryId");
CREATE INDEX IF NOT EXISTS "attributes_isGlobal_idx" ON "attributes"("isGlobal");

-- 3. Attribute Values Table (for SELECT type attributes)
CREATE TABLE IF NOT EXISTS "attribute_values" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attribute_values_attributeId_slug_key" ON "attribute_values"("attributeId", "slug");
CREATE INDEX IF NOT EXISTS "attribute_values_attributeId_idx" ON "attribute_values"("attributeId");

-- 4. Product Attributes Junction Table
CREATE TABLE IF NOT EXISTS "product_attributes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValueId" TEXT,
    "textValue" TEXT,
    "numberValue" DECIMAL(10, 2),
    "booleanValue" BOOLEAN,
    "dateValue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_attributes_productId_attributeId_key" ON "product_attributes"("productId", "attributeId");
CREATE INDEX IF NOT EXISTS "product_attributes_productId_idx" ON "product_attributes"("productId");
CREATE INDEX IF NOT EXISTS "product_attributes_attributeId_idx" ON "product_attributes"("attributeId");

-- 5. Tags Table
CREATE TABLE IF NOT EXISTS "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "description" TEXT,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_key" ON "tags"("slug");
CREATE INDEX IF NOT EXISTS "tags_category_idx" ON "tags"("category");
CREATE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags"("slug");

-- 6. Product Tags Junction Table
CREATE TABLE IF NOT EXISTS "product_tags" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_tags_productId_tagId_key" ON "product_tags"("productId", "tagId");
CREATE INDEX IF NOT EXISTS "product_tags_productId_idx" ON "product_tags"("productId");
CREATE INDEX IF NOT EXISTS "product_tags_tagId_idx" ON "product_tags"("tagId");

-- 7. Add categoryId column to products table (if not exists)
DO $$ BEGIN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");

-- 8. Add foreign key constraints
-- Categories self-reference
DO $$ BEGIN
    ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" 
    FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Attributes -> Categories
DO $$ BEGIN
    ALTER TABLE "attributes" ADD CONSTRAINT "attributes_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Attribute Values -> Attributes
DO $$ BEGIN
    ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attributeId_fkey" 
    FOREIGN KEY ("attributeId") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Product Attributes -> Products
DO $$ BEGIN
    ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Product Attributes -> Attributes
DO $$ BEGIN
    ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attributeId_fkey" 
    FOREIGN KEY ("attributeId") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Product Attributes -> Attribute Values
DO $$ BEGIN
    ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attributeValueId_fkey" 
    FOREIGN KEY ("attributeValueId") REFERENCES "attribute_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Products -> Categories
DO $$ BEGIN
    ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Product Tags -> Products
DO $$ BEGIN
    ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Product Tags -> Tags
DO $$ BEGIN
    ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tagId_fkey" 
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Migration complete
-- Note: Data migration for existing category strings and tags arrays will be handled separately

