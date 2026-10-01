/**
 * Migrate gallery images from Cloudinary to Cloudflare R2.
 *
 * Cloudinary account (hosworld) was disabled — images return 401.
 * This script attempts to recover images via the Cloudinary Admin API
 * (which may still work) and re-uploads them to Cloudflare R2.
 *
 * Prerequisites:
 *   1. Set env vars in .env (see .env.example for R2 section)
 *   2. Ensure DATABASE_URL points to your production/staging DB
 *   3. Run: npx ts-node scripts/migrate-cloudinary-to-r2.ts
 *
 * If Cloudinary Admin API also fails, the script will report which
 * images could not be recovered so you can re-upload originals manually.
 */
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ── R2 Configuration ────────────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.AWS_S3_ENDPOINT?.match(/([a-f0-9]{32})/)?.[1] || '';
const R2_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || '';
const R2_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.AWS_S3_BUCKET || '';
const R2_PUBLIC_URL = process.env.AWS_S3_PUBLIC_URL || '';
const R2_ENDPOINT = process.env.AWS_S3_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ── Cloudinary Configuration (for download attempt) ─────────────────
const CLD_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'hosworld';
const CLD_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLD_SECRET = process.env.CLOUDINARY_API_SECRET || '';

// ── Dry-run mode ────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

interface MigrationResult {
  imageId: string;
  oldUrl: string;
  newUrl: string | null;
  status: 'migrated' | 'skipped' | 'failed';
  error?: string;
}

function initR2Client(): S3Client {
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    console.error('\n❌  Missing R2 credentials. Set these env vars:');
    console.error('   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET');
    console.error('   AWS_S3_ENDPOINT (e.g. https://<account_id>.r2.cloudflarestorage.com)');
    console.error('   AWS_S3_PUBLIC_URL (e.g. https://pub-xxx.r2.dev or your custom domain)\n');
    process.exit(1);
  }

  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

function initCloudinary(): boolean {
  if (!CLD_KEY || !CLD_SECRET) {
    console.warn('⚠  Cloudinary API credentials not set — will try direct URL download only.');
    return false;
  }
  cloudinary.config({
    cloud_name: CLD_CLOUD,
    api_key: CLD_KEY,
    api_secret: CLD_SECRET,
  });
  return true;
}

/**
 * Extract the Cloudinary public_id from a delivery URL.
 * Example URL: https://res.cloudinary.com/hosworld/image/upload/v1784037877/gallery/us/.../file.png
 * Returns:     gallery/us/.../file  (without extension)
 */
function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?$/);
  return match?.[1] || null;
}

/**
 * Build the R2 object key from a Cloudinary URL.
 * Preserves the folder structure under gallery/.
 */
function buildR2Key(url: string): string {
  const publicId = extractPublicId(url);
  if (!publicId) {
    const filename = url.split('/').pop() || `unknown-${Date.now()}`;
    return `gallery/${filename}`;
  }
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  return `${publicId}${ext}`;
}

/**
 * Download a file from a URL into a Buffer.
 */
function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 30_000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Try downloading from Cloudinary using the Admin API (authenticated URL).
 * Falls back to direct CDN URL if Admin API fails.
 */
async function downloadFromCloudinary(url: string): Promise<Buffer> {
  // Strategy 1: Try Cloudinary Admin API URL (authenticated)
  const publicId = extractPublicId(url);
  if (publicId && CLD_KEY && CLD_SECRET) {
    try {
      const resource = await cloudinary.api.resource(publicId, {
        type: 'upload',
        resource_type: 'image',
      });
      if (resource?.secure_url) {
        const authUrl = cloudinary.url(publicId, {
          type: 'upload',
          resource_type: 'image',
          sign_url: true,
          secure: true,
        });
        return await downloadFile(authUrl);
      }
    } catch (e: any) {
      console.warn(`   Admin API failed for ${publicId}: ${e.message}`);
    }
  }

  // Strategy 2: Try the original URL directly (might work for some images)
  try {
    return await downloadFile(url);
  } catch (e: any) {
    throw new Error(`All download strategies failed: ${e.message}`);
  }
}

/**
 * Upload a buffer to R2 and return the public URL.
 */
async function uploadToR2(
  s3: S3Client,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  const publicBase = R2_PUBLIC_URL.replace(/\/$/, '');
  return `${publicBase}/${key}`;
}

function guessContentType(url: string): string {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[ext] || 'image/jpeg';
}

async function migrateCloudinaryUrl(
  s3: S3Client,
  url: string,
): Promise<string> {
  const buffer = await downloadFromCloudinary(url);
  console.log(`   ✓ Downloaded (${(buffer.length / 1024).toFixed(0)} KB)`);

  const key = buildR2Key(url);
  const contentType = guessContentType(url);
  const newUrl = await uploadToR2(s3, key, buffer, contentType);
  console.log(`   ✓ Uploaded to R2: ${key}`);
  return newUrl;
}

async function migrateGalleryImages(): Promise<void> {
  console.log('\n🔄  Cloudinary → Cloudflare R2 Gallery Migration');
  console.log('═'.repeat(55));

  if (DRY_RUN) {
    console.log('📋  DRY RUN — no changes will be made\n');
  }

  initCloudinary();
  const s3 = DRY_RUN ? (null as any) : initR2Client();

  // Find all gallery images with Cloudinary URLs
  const images = await prisma.galleryImage.findMany({
    where: { url: { contains: 'cloudinary.com' } },
    orderBy: { order: 'asc' },
    include: { album: { select: { title: true, slug: true } } },
  });

  // Also find album cover URLs
  const albums = await prisma.galleryAlbum.findMany({
    where: { coverUrl: { contains: 'cloudinary.com' } },
  });

  const totalImages = images.length;
  const totalCovers = albums.length;
  console.log(`Found ${totalImages} gallery image(s) on Cloudinary`);
  console.log(`Found ${totalCovers} album cover URL(s) on Cloudinary\n`);

  if (totalImages === 0 && totalCovers === 0) {
    console.log('✅  Nothing to migrate.');
    return;
  }

  // Also check product images
  const productImages = await prisma.productImage.count({
    where: { url: { contains: 'cloudinary.com' } },
  });
  if (productImages > 0) {
    console.log(`⚠  Found ${productImages} product image(s) also on Cloudinary.`);
    console.log('   Run with --include-products to migrate those too.\n');
  }

  const results: MigrationResult[] = [];
  const urlMap = new Map<string, string>(); // old URL → new URL

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const label = `[${i + 1}/${totalImages}]`;
    const albumName = img.album?.title || 'unknown album';
    console.log(`${label} ${albumName} — ${img.url.split('/').pop()}`);

    if (DRY_RUN) {
      const key = buildR2Key(img.url);
      const predictedUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
      console.log(`   → Would upload to: ${key}`);
      urlMap.set(img.url, predictedUrl);
      results.push({ imageId: img.id, oldUrl: img.url, newUrl: null, status: 'skipped' });
      continue;
    }

    try {
      const newUrl = await migrateCloudinaryUrl(s3, img.url);

      await prisma.galleryImage.update({
        where: { id: img.id },
        data: { url: newUrl },
      });
      console.log(`   ✓ DB updated`);

      urlMap.set(img.url, newUrl);
      results.push({ imageId: img.id, oldUrl: img.url, newUrl, status: 'migrated' });
    } catch (err: any) {
      console.error(`   ✗ FAILED: ${err.message}`);
      results.push({ imageId: img.id, oldUrl: img.url, newUrl: null, status: 'failed', error: err.message });
    }
  }

  // Covers can be a custom Cloudinary URL that is not in gallery_images.
  // Remap from migrated images when possible; otherwise migrate the cover itself.
  if (albums.length > 0) {
    console.log(`\n${'─'.repeat(55)}`);
    console.log('Migrating album cover URLs...\n');
  }

  for (const album of albums) {
    const coverUrl = album.coverUrl!;
    console.log(`Cover · ${album.title} — ${coverUrl.split('/').pop()}`);

    if (DRY_RUN) {
      const mapped = urlMap.get(coverUrl);
      if (mapped) {
        console.log(`   → Would remap from migrated gallery image`);
      } else {
        console.log(`   → Would upload independently to: ${buildR2Key(coverUrl)}`);
      }
      results.push({
        imageId: `cover:${album.id}`,
        oldUrl: coverUrl,
        newUrl: null,
        status: 'skipped',
      });
      continue;
    }

    try {
      let newCover = urlMap.get(coverUrl);
      if (!newCover) {
        newCover = await migrateCloudinaryUrl(s3, coverUrl);
        urlMap.set(coverUrl, newCover);
      } else {
        console.log(`   ✓ Remapped from migrated gallery image`);
      }

      await prisma.galleryAlbum.update({
        where: { id: album.id },
        data: { coverUrl: newCover },
      });
      console.log(`   ✓ Cover URL updated`);
      results.push({
        imageId: `cover:${album.id}`,
        oldUrl: coverUrl,
        newUrl: newCover,
        status: 'migrated',
      });
    } catch (err: any) {
      console.error(`   ✗ FAILED: ${err.message}`);
      results.push({
        imageId: `cover:${album.id}`,
        oldUrl: coverUrl,
        newUrl: null,
        status: 'failed',
        error: err.message,
      });
    }
  }

  // Include product images if flag is set
  if (process.argv.includes('--include-products') && productImages > 0) {
    console.log(`\n${'─'.repeat(55)}`);
    console.log('Migrating product images...\n');

    const prodImgs = await prisma.productImage.findMany({
      where: { url: { contains: 'cloudinary.com' } },
      include: { product: { select: { name: true } } },
    });

    for (let i = 0; i < prodImgs.length; i++) {
      const img = prodImgs[i];
      const label = `[${i + 1}/${prodImgs.length}]`;
      console.log(`${label} ${img.product?.name || 'unknown'} — ${img.url.split('/').pop()}`);

      if (DRY_RUN) {
        console.log(`   → Would migrate`);
        continue;
      }

      try {
        const newUrl = await migrateCloudinaryUrl(s3, img.url);

        await prisma.productImage.update({
          where: { id: img.id },
          data: { url: newUrl },
        });
        console.log(`   ✓ Migrated`);
      } catch (err: any) {
        console.error(`   ✗ FAILED: ${err.message}`);
      }
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(55)}`);
  const migrated = results.filter((r) => r.status === 'migrated').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  console.log(`✅  Migrated: ${migrated}`);
  if (skipped) console.log(`⏭  Skipped (dry run): ${skipped}`);
  if (failed) {
    console.log(`❌  Failed: ${failed}`);
    console.log('\nFailed images (need manual re-upload):');
    results
      .filter((r) => r.status === 'failed')
      .forEach((r) => console.log(`   • ${r.oldUrl}\n     Error: ${r.error}`));
  }

  console.log('');
}

migrateGalleryImages()
  .catch((err) => {
    console.error('\n💥  Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
