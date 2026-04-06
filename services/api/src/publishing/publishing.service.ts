import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MeilisearchService } from '../meilisearch/meilisearch.service';
import { ProductSubmissionStatus, ProductStatus, ImageType } from '@prisma/client';

interface PricingData {
  basePrice: number;
  hosMargin: number;
  finalPrice: number;
  visibilityLevel: string;
}

const VALID_PUBLISH_FROM: ReadonlySet<string> = new Set(['FINANCE_APPROVED']);
const VALID_UNPUBLISH_FROM: ReadonlySet<string> = new Set(['PUBLISHED']);

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private notificationsService: NotificationsService,
    @Optional() private meilisearchService?: MeilisearchService,
  ) {}

  async publish(submissionId: string, userId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
      include: {
        seller: true,
        catalogEntry: true,
        marketingMaterials: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (!VALID_PUBLISH_FROM.has(submission.status)) {
      throw new BadRequestException(
        `Cannot publish from status "${submission.status}". Product must be in FINANCE_APPROVED status.`,
      );
    }

    if (!submission.catalogEntry) {
      throw new BadRequestException('Catalog entry is required for publishing');
    }

    const productData = submission.productData as any;
    const catalogEntry = submission.catalogEntry;

    // Use structured pricingData (set by finance service), fall back to legacy regex for old submissions
    const pricingData = submission.pricingData as unknown as PricingData | null;
    let finalPrice: number;
    let hosMargin: number;
    let visibilityLevel: string;

    if (pricingData && pricingData.finalPrice) {
      finalPrice = pricingData.finalPrice;
      hosMargin = pricingData.hosMargin;
      visibilityLevel = pricingData.visibilityLevel || 'STANDARD';
    } else {
      // Legacy fallback: extract from finance notes (for submissions created before pricingData field)
      const financeNotes = submission.financeNotes || '';
      const priceMatch = financeNotes.match(/Final: [£$]([\d.]+)/);
      finalPrice = priceMatch ? parseFloat(priceMatch[1]) : productData.price;
      const marginMatch = financeNotes.match(/Margin: ([\d.]+)%/);
      hosMargin = marginMatch ? parseFloat(marginMatch[1]) / 100 : 0.15;
      visibilityLevel = 'STANDARD';
    }

    // Use catalog images, or fall back to submission productData.images (may be { url }[] or string[])
    const imageUrls: string[] =
      Array.isArray(catalogEntry.images) && catalogEntry.images.length > 0
        ? catalogEntry.images
        : Array.isArray(productData.images)
          ? productData.images
              .map((img: string | { url: string }) => (typeof img === 'string' ? img : img?.url))
              .filter(Boolean)
          : [];

    // Check for existing product with matching identifiers to prevent duplicates.
    // If a matching product already exists, create a VendorProduct link instead of a new Product.
    const sku = productData.sku?.trim();
    const barcode = productData.barcode?.trim();
    const ean = productData.ean?.trim();

    let existingProduct: { id: string; sellerId: string | null } | null = null;
    if (sku || barcode || ean) {
      const matchConditions: any[] = [];
      if (sku) matchConditions.push({ sku });
      if (barcode) matchConditions.push({ barcode });
      if (ean) matchConditions.push({ ean });

      existingProduct = await this.prisma.product.findFirst({
        where: {
          status: { in: ['ACTIVE', 'DRAFT'] },
          OR: matchConditions,
          sellerId: { not: submission.seller.id },
        },
        select: { id: true, sellerId: true },
      });
    }

    let product: any;

    if (existingProduct) {
      // Product already exists under a different seller — create a VendorProduct link
      // instead of a duplicate Product record
      this.logger.log(
        `Duplicate product detected (existing: ${existingProduct.id}). ` +
          `Creating VendorProduct for seller ${submission.seller.id} instead of new Product.`,
      );

      const existingVP = await this.prisma.vendorProduct.findUnique({
        where: {
          sellerId_productId: {
            sellerId: submission.seller.id,
            productId: existingProduct.id,
          },
        },
      });

      if (!existingVP) {
        await this.prisma.vendorProduct.create({
          data: {
            sellerId: submission.seller.id,
            productId: existingProduct.id,
            vendorPrice: finalPrice,
            vendorCurrency: productData.currency || 'USD',
            costPrice: productData.tradePrice || null,
            vendorStock: submission.selectedQuantity || productData.stock || 0,
            lowStockThreshold: 5,
            allowBackorder: false,
            leadTimeDays: 3,
            status: 'ACTIVE',
            platformPrice: finalPrice,
            marginPercent: hosMargin,
            approvedAt: new Date(),
            approvedBy: userId,
            submittedAt: new Date(),
          },
        });
      } else {
        await this.prisma.vendorProduct.update({
          where: { id: existingVP.id },
          data: {
            vendorPrice: finalPrice,
            vendorStock: { increment: submission.selectedQuantity || productData.stock || 0 },
            status: 'ACTIVE',
          },
        });
      }

      product = await this.prisma.product.findUnique({
        where: { id: existingProduct.id },
        include: {
          images: { orderBy: { order: 'asc' } },
          seller: { select: { id: true, storeName: true, slug: true } },
        },
      });
    } else {
      // No duplicate — create a new product as normal
      product = await this.productsService.create(submission.seller.userId, {
        name: catalogEntry.title,
        description: catalogEntry.description,
        sku: productData.sku,
        barcode: productData.barcode,
        ean: productData.ean,
        price: finalPrice,
        tradePrice: productData.tradePrice,
        rrp: productData.rrp,
        currency: productData.currency || 'USD',
        taxRate: productData.taxRate > 1 ? productData.taxRate / 100 : productData.taxRate || 0,
        stock: submission.selectedQuantity || productData.stock || 0,
        fandom: productData.fandom,
        category: productData.category,
        categoryId: productData.categoryId,
        tags: productData.tags || [],
        status: 'ACTIVE' as any,
        images: imageUrls.map((url, index) => ({
          url,
          alt: catalogEntry.title,
          order: index,
          type: ImageType.IMAGE,
        })),
        variations: productData.variations || [],
      });
    }

    // Link product to submission
    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        productId: product.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Create ProductPricing record (for new products or updated pricing for existing ones)
    const existingPricing = await this.prisma.productPricing.findFirst({
      where: { productId: product.id },
    });
    if (!existingPricing) {
      await this.prisma.productPricing.create({
        data: {
          productId: product.id,
          basePrice: pricingData?.basePrice ?? productData.price,
          hosMargin: hosMargin,
          finalPrice: finalPrice,
          visibilityLevel: visibilityLevel as any,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    }

    // Index in MeiliSearch (non-blocking — don't let search indexing failures block publish)
    if (this.meilisearchService) {
      this.meilisearchService.indexProduct(product).catch((err) => {
        this.logger.warn(
          `MeiliSearch indexing failed for product ${product.id}, will be retried on next sync`,
          err,
        );
      });
    }

    // Send notification to seller
    if (submission.seller?.userId) {
      await this.notificationsService.sendNotificationToUser(
        submission.seller.userId,
        'PRODUCT_PUBLISHED',
        'Product Published Successfully',
        `Your product submission "${product.name}" has been published and is now live on the marketplace.`,
        { productId: product.id, submissionId },
      );
    }

    return {
      product,
      submission,
      published: true,
    };
  }

  async bulkPublish(submissionIds: string[], userId: string) {
    const results = [];

    for (const submissionId of submissionIds) {
      try {
        const result = await this.publish(submissionId, userId);
        results.push({ submissionId, success: true, result });
      } catch (error: any) {
        results.push({
          submissionId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      total: submissionIds.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async unpublish(submissionId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
      include: { product: true, seller: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (!VALID_UNPUBLISH_FROM.has(submission.status)) {
      throw new BadRequestException(
        `Cannot unpublish from status "${submission.status}". Only PUBLISHED submissions can be unpublished.`,
      );
    }

    if (submission.productId) {
      await this.prisma.product.update({
        where: { id: submission.productId },
        data: { status: 'INACTIVE' },
      });

      // Remove from MeiliSearch (non-blocking)
      if (this.meilisearchService) {
        this.meilisearchService.deleteProduct(submission.productId).catch((err) => {
          this.logger.warn(`MeiliSearch removal failed for product ${submission.productId}`, err);
        });
      }
    }

    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: { status: 'FINANCE_APPROVED' },
    });

    return { submissionId, unpublished: true };
  }

  async getReadyToPublish() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: 'FINANCE_APPROVED',
      },
      take: 100,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            customDomain: true,
            subDomain: true,
          },
        },
        catalogEntry: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { financeApprovedAt: 'asc' },
    });

    return submissions;
  }

  async getPublishedProducts() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: 'PUBLISHED',
      },
      take: 100,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            price: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return submissions;
  }
}
