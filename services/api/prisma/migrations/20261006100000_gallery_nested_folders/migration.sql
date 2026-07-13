-- AlterTable
ALTER TABLE "gallery_albums" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "gallery_albums" ADD COLUMN "outletSlug" TEXT;

-- CreateIndex
CREATE INDEX "gallery_albums_countryCode_outletSlug_idx" ON "gallery_albums"("countryCode", "outletSlug");
