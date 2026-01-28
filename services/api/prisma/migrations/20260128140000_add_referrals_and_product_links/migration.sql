-- Referrals and influencer product links tables (idempotent)

-- referrals table
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "visitorId" TEXT,
  "userId" TEXT,
  "landingPage" TEXT,
  "productId" TEXT,
  "campaignId" TEXT,
  "utmParams" JSONB,
  "orderId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "orderTotal" DECIMAL(10,2),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referrals_orderId_key" ON "referrals"("orderId");
CREATE INDEX IF NOT EXISTS "referrals_influencerId_idx" ON "referrals"("influencerId");
CREATE INDEX IF NOT EXISTS "referrals_visitorId_idx" ON "referrals"("visitorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_influencerId_fkey') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_influencerId_fkey"
      FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_orderId_fkey') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- influencer_product_links table
CREATE TABLE IF NOT EXISTS "influencer_product_links" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customSlug" TEXT,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencer_product_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "influencer_product_links_influencerId_productId_key"
  ON "influencer_product_links"("influencerId", "productId");
CREATE INDEX IF NOT EXISTS "influencer_product_links_influencerId_idx"
  ON "influencer_product_links"("influencerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_product_links_influencerId_fkey') THEN
    ALTER TABLE "influencer_product_links" ADD CONSTRAINT "influencer_product_links_influencerId_fkey"
      FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_product_links_productId_fkey') THEN
    ALTER TABLE "influencer_product_links" ADD CONSTRAINT "influencer_product_links_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
