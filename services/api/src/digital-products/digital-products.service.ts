import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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

    // In production, generate a signed URL from storage service
    return {
      downloadUrl: `/api/digital-products/${id}/file`,
      fileName: product.fileName,
      expiresIn: 3600,
      remainingDownloads: this.MAX_DOWNLOADS - product.downloadCount - 1,
    };
  }

  /**
   * Check if a product is digital based on tags
   */
  private isDigitalProduct(tags: string[]): boolean {
    const digitalKeywords = ['digital', 'ebook', 'pdf', 'download', 'virtual', 'printable'];
    return tags.some(tag => 
      digitalKeywords.some(keyword => 
        tag.toLowerCase().includes(keyword)
      )
    );
  }
}
