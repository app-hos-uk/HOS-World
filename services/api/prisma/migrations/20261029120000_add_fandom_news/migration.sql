-- AlterTable
ALTER TABLE "events" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "marketCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "showOnLanding" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "fandom_news_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "feedType" TEXT NOT NULL DEFAULT 'rss',
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marketCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastFetchedAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fandom_news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fandom_news_articles" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "videoType" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'article',
    "author" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "marketCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'auto',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fandom_news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fandom_news_sources_feedUrl_key" ON "fandom_news_sources"("feedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "fandom_news_articles_externalUrl_key" ON "fandom_news_articles"("externalUrl");

-- CreateIndex
CREATE INDEX "fandom_news_articles_status_publishedAt_idx" ON "fandom_news_articles"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "fandom_news_articles_sourceId_idx" ON "fandom_news_articles"("sourceId");

-- AddForeignKey
ALTER TABLE "fandom_news_articles" ADD CONSTRAINT "fandom_news_articles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "fandom_news_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
