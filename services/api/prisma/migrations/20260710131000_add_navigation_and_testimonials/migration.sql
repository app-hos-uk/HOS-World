-- CreateTable: navigation_items
CREATE TABLE IF NOT EXISTS "navigation_items" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "navigation_items_group_isActive_order_idx" ON "navigation_items"("group", "isActive", "order");

-- CreateTable: testimonials
CREATE TABLE IF NOT EXISTS "testimonials" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "city" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "testimonials_isActive_order_idx" ON "testimonials"("isActive", "order");

-- Seed navigation items only if table is empty (idempotent across re-deploys)
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM "navigation_items" LIMIT 1) THEN
  INSERT INTO "navigation_items" ("id", "group", "label", "href", "order", "isActive", "external", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), 'header_primary', 'Deals of the day', '/products?sortBy=price_asc&deals=true', 0, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_primary', 'Shop by franchise', '/fandoms', 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_primary', 'Collectibles', '/products?category=collectibles', 2, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_primary', 'Blog', '/blog', 3, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_more', 'Apparel & robes', '/products?category=apparel', 0, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_more', 'Home & gifts', '/products?category=home-gifts', 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_more', 'Marketplace vendors', '/sellers', 2, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_more', 'All products', '/products', 3, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'header_more', 'Gift cards', '/gift-cards', 4, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'Shop Now', '/fandoms', 0, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'Blog', '/blog', 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'On Sale', '/products', 2, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'Gift Cards', '/gift-cards', 3, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'My Account', '/customer/dashboard', 4, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'Loyalty Program', '/loyalty', 5, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'About Us', '/the-experience', 6, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_shop', 'Contact Us', '/support/new', 7, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_policy', 'Help Center', '/help', 0, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_policy', 'Privacy Policy', '/privacy-policy', 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_policy', 'Refund Policy', '/refund-policy', 2, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_policy', 'Shipping Policy', '/shipping', 3, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_policy', 'Terms of Service', '/terms', 4, true, false, NOW(), NOW()),
    (gen_random_uuid(), 'footer_policy', 'FAQs', '/help#faqs', 5, true, false, NOW(), NOW());
END IF;
END $$;

-- CreateTable: platform_settings
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_category_key_key" ON "platform_settings"("category", "key");
CREATE INDEX IF NOT EXISTS "platform_settings_category_idx" ON "platform_settings"("category");

-- Seed testimonials only if table is empty (idempotent across re-deploys)
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM "testimonials" LIMIT 1) THEN
  INSERT INTO "testimonials" ("id", "quote", "author", "city", "rating", "verified", "order", "isActive", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), 'Finally one place that feels like the shop floor in New York — I can bundle gifts from two vendors in a single order.', 'Eilidh M.', 'Austin', 5, true, 0, true, NOW(), NOW()),
    (gen_random_uuid(), 'Love the franchise strips and how clearly each seller''s ratings show up. Feels safer than random resale sites.', 'James T.', 'Chicago', 5, true, 1, true, NOW(), NOW()),
    (gen_random_uuid(), 'The collectibles section is dangerous for my wallet. Arrived in two days, well packed — display case is showroom quality.', 'Priya K.', 'Seattle', 5, true, 2, true, NOW(), NOW());
END IF;
END $$;
