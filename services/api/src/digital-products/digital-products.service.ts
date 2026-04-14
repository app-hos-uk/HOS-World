import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface DigitalProduct {
  id: string;
  name: string;
  description?: string;
  fileUrl?: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  downloadCount: number;
  maxDownloads: number;
  expiresAt?: Date;
  purchasedAt: Date;
  orderId: string;
  productId: string;
  status: 'available' | 'expired' | 'limit_reached';
}

export interface DownloadResult {
  downloadUrl: string;
  fileName: string;
  expiresIn: number;
  remainingDownloads: number;
}

@Injectable()
export class DigitalProductsService {
  private readonly MAX_DOWNLOADS = 10;
  private readonly EXPIRY_DAYS = 365;

  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Get all digital products purchased by a user
   * Digital products are identified by having certain tags
   */
  async getUserDigitalProducts(userId: string): Promise<DigitalProduct[]> {
    // Get all delivered/completed orders with their items
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['DELIVERED', 'FULFILLED', 'SHIPPED'] },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                tags: true,
                images: {
                  select: { url: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const digitalProducts: DigitalProduct[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.product) continue;

        // Check if product is digital (has 'digital' in tags)
        const isDigital = this.isDigitalProduct(item.product.tags || []);

        if (!isDigital) continue;

        // Get download count from activity logs
        const downloadCount = await this.prisma.activityLog.count({
          where: {
            userId,
            action: 'DIGITAL_PRODUCT_DOWNLOAD',
            entityType: 'Product',
            entityId: item.product.id,
          },
        });

        const expiresAt = new Date(order.createdAt);
        expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);

        const isExpired = expiresAt < new Date();
        const isLimitReached = downloadCount >= this.MAX_DOWNLOADS;

        let status: 'available' | 'expired' | 'limit_reached' = 'available';
        if (isExpired) status = 'expired';
        else if (isLimitReached) status = 'limit_reached';

        digitalProducts.push({
          id: `${order.id}-${item.product.id}`,
          name: item.product.name,
          description: item.product.description || undefined,
          fileUrl: item.product.images?.[0]?.url || undefined,
          fileName: `${item.product.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          fileType: 'PDF Document',
          downloadCount,
          maxDownloads: this.MAX_DOWNLOADS,
          expiresAt,
          purchasedAt: order.createdAt,
          orderId: order.id,
          productId: item.product.id,
          status,
        });
      }
    }

    return digitalProducts;
  }

  /**
   * Get a specific digital product by ID
   */
  async getDigitalProduct(id: string, userId: string): Promise<DigitalProduct> {
    const parts = id.split('-');
    if (parts.length < 2) {
      throw new NotFoundException('Invalid digital product ID');
    }

    // The ID format is orderId-productId, both are UUIDs
    const orderId = parts.slice(0, 5).join('-');
    const productId = parts.slice(5).join('-');

    if (!orderId || !productId) {
      throw new NotFoundException('Invalid digital product ID');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: { in: ['DELIVERED', 'FULFILLED', 'SHIPPED'] },
      },
      include: {
        items: {
          where: {
            productId,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                tags: true,
              },
            },
          },
        },
      },
    });

    if (!order || order.items.length === 0) {
      throw new NotFoundException('Digital product not found');
    }

    const item = order.items[0];
    if (!item.product) {
      throw new NotFoundException('Product not found');
    }

    // Get download count
    const downloadCount = await this.prisma.activityLog.count({
      where: {
        userId,
        action: 'DIGITAL_PRODUCT_DOWNLOAD',
        entityType: 'Product',
        entityId: productId,
      },
    });

    const expiresAt = new Date(order.createdAt);
    expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);

    const isExpired = expiresAt < new Date();
    const isLimitReached = downloadCount >= this.MAX_DOWNLOADS;

    let status: 'available' | 'expired' | 'limit_reached' = 'available';
    if (isExpired) status = 'expired';
    else if (isLimitReached) status = 'limit_reached';

    return {
      id,
      name: item.product.name,
      description: item.product.description || undefined,
      fileName: `${item.product.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      fileType: 'PDF Document',
      downloadCount,
      maxDownloads: this.MAX_DOWNLOADS,
      expiresAt,
      purchasedAt: order.createdAt,
      orderId: order.id,
      productId: item.product.id,
      status,
    };
  }

  /**
   * Generate a secure download URL for a digital product
   */
  async downloadDigitalProduct(id: string, userId: string): Promise<DownloadResult> {
    const product = await this.getDigitalProduct(id, userId);

    if (product.status === 'expired') {
      throw new ForbiddenException('Download link has expired');
    }

    if (product.status === 'limit_reached') {
      throw new ForbiddenException('Maximum download limit reached');
    }

    // Log the download
    await this.prisma.activityLog.create({
      data: {
        user: { connect: { id: userId } },
        action: 'DIGITAL_PRODUCT_DOWNLOAD',
        entityType: 'Product',
        entityId: product.productId,
        description: `Downloaded digital product: ${product.name}`,
        metadata: {
          productId: product.productId,
          orderId: product.orderId,
          downloadNumber: product.downloadCount + 1,
        },
      },
    });

    return {
      downloadUrl: `/api/digital-products/${id}/file`,
      fileName: product.fileName,
      expiresIn: 3600,
      remainingDownloads: this.MAX_DOWNLOADS - product.downloadCount - 1,
    };
  }

  /**
   * Resolve a redirect URL for GET :id/file.
   * Also increments the download counter so the endpoint cannot bypass limits.
   */
  async getSignedFileRedirectUrl(compositeId: string, userId: string): Promise<string> {
    const digital = await this.getDigitalProduct(compositeId, userId);
    if (digital.status === 'expired') {
      throw new ForbiddenException('Download link has expired');
    }
    if (digital.status === 'limit_reached') {
      throw new ForbiddenException('Maximum download limit reached');
    }

    await this.prisma.activityLog.create({
      data: {
        user: { connect: { id: userId } },
        action: 'DIGITAL_PRODUCT_DOWNLOAD',
        entityType: 'Product',
        entityId: digital.productId,
        description: `Downloaded digital product (file redirect): ${digital.name}`,
        metadata: {
          productId: digital.productId,
          orderId: digital.orderId,
          downloadNumber: digital.downloadCount + 1,
        },
      },
    });

    // 1. Check if the OrderItem's variationOptions contains a downloadUrl (extensible JSON field)
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        orderId: digital.orderId,
        productId: digital.productId,
      },
      select: { variationOptions: true },
    });
    const opts = orderItem?.variationOptions as Record<string, string> | null;
    if (opts?.downloadUrl) {
      return this.storageService.getSignedUrl(opts.downloadUrl, 3600);
    }

    // 2. Fall back to the first product image URL (no dedicated file field in schema)
    const product = await this.prisma.product.findUnique({
      where: { id: digital.productId },
      include: {
        images: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { url: true },
        },
      },
    });

    const rawUrl = product?.images?.[0]?.url;
    if (!rawUrl) {
      throw new NotFoundException(
        'No downloadable file is configured for this product. ' +
          'Set a downloadUrl in the order item variationOptions or add a product image.',
      );
    }

    return this.storageService.getSignedUrl(rawUrl, 3600);
  }

  /**
   * Check if a product is digital based on tags
   */
  private isDigitalProduct(tags: string[]): boolean {
    const digitalKeywords = ['digital', 'ebook', 'pdf', 'download', 'virtual', 'printable'];
    return tags.some((tag) =>
      digitalKeywords.some((keyword) => tag.toLowerCase().includes(keyword)),
    );
  }
}
