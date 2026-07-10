-- CreateTable
CREATE TABLE IF NOT EXISTS "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT NOT NULL,
    "iconSvg" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "departments_slug_key" ON "departments"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "departments_isActive_order_idx" ON "departments"("isActive", "order");

-- AddForeignKey (safe: only if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_categoryId_fkey'
  ) THEN
    ALTER TABLE "departments" ADD CONSTRAINT "departments_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed initial departments from the previously hardcoded values
INSERT INTO "departments" ("id", "name", "slug", "description", "meta", "ctaText", "ctaUrl", "iconSvg", "order", "isActive", "updatedAt")
VALUES
  (gen_random_uuid(), 'Collectibles & replicas', 'collectibles',
   'Wands, statuettes, and prop replicas from rated sellers.',
   '2.4k+ listings · props & figures', 'Shop collectibles',
   '/products?category=collectibles',
   '<svg viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M32 8 L38 26 L56 28 L42 40 L46 58 L32 48 L18 58 L22 40 L8 28 L26 26 Z"/></svg>',
   0, true, NOW()),
  (gen_random_uuid(), 'Apparel & robes', 'apparel',
   'House colors, cosplay basics, and cozy fan layers.',
   'Robes, tees, scarves & layers', 'Shop apparel',
   '/products?category=apparel',
   '<svg viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 12 L42 12 L48 22 L44 52 L20 52 L16 22 Z"/><path d="M28 12 V22 M36 12 V22"/></svg>',
   1, true, NOW()),
  (gen_random_uuid(), 'Home & gifts', 'home-gifts',
   'Mugs, lamps, and gift-ready sets for any occasion.',
   'Gifts, décor & tableware', 'Shop home & gifts',
   '/products?category=home-gifts',
   '<svg viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 28 L32 14 L52 28 V54 H12 Z"/><rect x="26" y="38" width="12" height="16"/></svg>',
   2, true, NOW())
ON CONFLICT ("slug") DO NOTHING;
