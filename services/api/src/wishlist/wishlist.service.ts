import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Product } from '@hos-marketplace/shared-types';
import { ProductStatus, ImageType } from '@prisma/client';

// Valid product status values for the shared types Product interface
type ValidProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock';

const VALID_PRODUCT_STATUSES: Set<string> = new Set(['draft', 'active', 'inactive', 'out_of_stock']);

/**
 * Normalize and validate a product status from Prisma enum to shared types literal.
 * Prisma uses uppercase (DRAFT, ACTIVE, etc.) while shared types use lowercase.
 * Unknown or invalid statuses default to 'inactive' to prevent type mismatches.
 */
function normalizeProductStatus(status: string | null | undefined): ValidProductStatus {
  if (!status) return 'draft';
  
  const normalized = status.toLowerCase();
  
  // Only return if it's a known valid status
  if (VALID_PRODUCT_STATUSES.has(normalized)) {
    return normalized as ValidProductStatus;
  }
  
  // For any unknown status (ARCHIVED, DISCONTINUED, etc.), default to 'inactive'
  // as it's the safest semantic match for non-active products
  return 'inactive';
}

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async addToWishlist(userId: string, productId: string): Promise<void> {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
    });
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Product not found in wishlist');
    }

    await this.prisma.wishlistItem.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
  }

  async getWishlist(userId: string, page: number = 1, limit: number = 20): Promise<{
    products: Product[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.wishlistItem.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1,
              },
              seller: {
                select: {
                  id: true,
                  storeName: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.wishlistItem.count({
        where: { userId },
      }),
    ]);

    return {
      products: items.map((item) => this.mapToProductType(item.product)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return !!item;
  }

  private mapToProductType(product: any): Product {
    return {
      id: product.id,
      sellerId: product.seller.userId || product.sellerId,
      name: product.name,
      description: product.description,
      slug: product.slug,
      sku: product.sku || undefined,
      barcode: product.barcode || undefined,
      ean: product.ean || undefined,
      price: Number(product.price),
      tradePrice: product.tradePrice ? Number(product.tradePrice) : undefined,
      rrp: product.rrp ? Number(product.rrp) : undefined,
      currency: product.currency,
      taxRate: Number(product.taxRate),
      stock: product.stock,
      images: product.images?.map((img: any) => ({
        id: img.id,
        url: img.url,
        alt: img.alt || undefined,
        order: img.order,
        type: img.type as ImageType,
      })) || [],
      variations: undefined,
      fandom: product.fandom || undefined,
      category: product.category || undefined,
      tags: product.tags || [],
      status: normalizeProductStatus(product.status),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}


