-- CreateTable
CREATE TABLE "universes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "tag" TEXT,
    "description" TEXT,
    "accentColor" TEXT,
    "gradientColors" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "universes_name_key" ON "universes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "universes_slug_key" ON "universes"("slug");

-- CreateIndex
CREATE INDEX "universes_isActive_order_idx" ON "universes"("isActive", "order");
