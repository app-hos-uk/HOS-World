-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "coverImage" TEXT,
    "coverImageAlt" TEXT,
    "coverImageTitle" TEXT,
    "author" TEXT NOT NULL,
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "readingTime" INTEGER,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "focusKeyword" TEXT,
    "canonicalUrl" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_categories_slug_idx" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_publishedAt_idx" ON "blog_posts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "blog_posts_categoryId_idx" ON "blog_posts"("categoryId");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default blog categories
INSERT INTO "blog_categories" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'New York', 'new-york', 'Stories from our New York flagship experience', NOW(), NOW()),
  (gen_random_uuid()::text, 'Harry Potter', 'harry-potter', 'Wizarding world news, guides, and collectibles', NOW(), NOW()),
  (gen_random_uuid()::text, 'Stranger Things', 'stranger-things', 'Upside Down fandom articles and merch highlights', NOW(), NOW()),
  (gen_random_uuid()::text, 'Spiderman', 'spiderman', 'Marvel Spiderman collectibles and fan content', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
