import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductSubmissionStatus, ProductStatus, ImageType } from '@prisma/client';

interface PricingData {
  basePrice: number;
  hosMargin: number;
  finalPrice: number;
  visibilityLevel: string;
}

@Injectable()
export class PublishingService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private notificationsService: NotificationsService,
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

    if (submission.status !== 'FINANCE_APPROVED') {
      throw new BadRequestException('Product can only be published after finance approval');
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

    // Create product from submission
    const product = await this.productsService.create(submission.seller.userId, {
      name: catalogEntry.title,
      description: catalogEntry.description,
      sku: productData.sku,
      barcode: productData.barcode,
      ean: productData.ean,
      price: finalPrice,
      tradePrice: productData.tradePrice,
      rrp: productData.rrp,
      currency: productData.currency || 'GBP',
      taxRate: productData.taxRate > 1 ? productData.taxRate / 100 : productData.taxRate || 0,
      stock: submission.selectedQuantity || productData.stock || 0,
      fandom: productData.fandom,
      category: productData.category, // Legacy field - kept for backward compatibility
      categoryId: productData.categoryId, // New taxonomy category ID
      tags: productData.tags || [],
      status: 'ACTIVE' as any, // Status is handled separately
      images: imageUrls.map((url, index) => ({
        url,
        alt: catalogEntry.title,
        order: index,
        type: ImageType.IMAGE,
      })),
      variations: productData.variations || [],
    });

    // Link product to submission
    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        productId: product.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Create ProductPricing record
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
