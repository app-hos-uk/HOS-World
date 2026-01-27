import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ShareItemDto } from './dto/share-item.dto';

@Injectable()
export class SocialSharingService {
  constructor(private prisma: PrismaService) {}

  async shareItem(userId: string, dto: ShareItemDto): Promise<any> {
    // Get the item being shared based on type
    let itemContent: any = {};

    switch (dto.type) {
      case 'PRODUCT':
        const product = await this.prisma.product.findUnique({
          where: { id: dto.itemId },
          include: {
            images: { take: 1 },
            seller: {
              select: {
                storeName: true,
                slug: true,
              },
            },
          },
        });
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        itemContent = {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images[0]?.url,
          seller: product.seller?.storeName || 'House of Spells',
          url: `/products/${product.id}`,
        };
        break;

      case 'COLLECTION':
        const collection = await this.prisma.collection.findFirst({
          where: {
            id: dto.itemId,
            OR: [{ userId }, { isPublic: true }],
          },
        });
        if (!collection) {
          throw new NotFoundException('Collection not found');
        }
        itemContent = {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          itemCount: Array.isArray(collection.items) ? collection.items.length : 0,
          url: `/collections/${collection.id}`,
        };
        break;

      case 'ACHIEVEMENT':
        const badge = await this.prisma.userBadge.findFirst({
          where: {
            userId,
            badgeId: dto.itemId,
          },
          include: {
            badge: true,
          },
        });
        if (!badge) {
          throw new NotFoundException('Achievement not found');
        }
        itemContent = {
          id: badge.badge.id,
          name: badge.badge.name,
          description: badge.badge.description,
          icon: badge.badge.icon,
          rarity: badge.badge.rarity,
          url: `/profile/badges/${badge.badge.id}`,
        };
        break;

      default:
        throw new NotFoundException('Invalid share type');
    }

    // Create share record
    const sharedItem = await this.prisma.sharedItem.create({
      data: {
        userId,
        type: dto.type,
        itemId: dto.itemId,
        content: itemContent,
        platform: dto.platform,
      },
    });

    return sharedItem;
  }

  async getSharedItems(userId?: string, limit: number = 20): Promise<any[]> {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    return this.prisma.sharedItem.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async trackShareView(shareId: string): Promise<void> {
    await this.prisma.sharedItem.update({
      where: { id: shareId },
      data: {
        views: {
          increment: 1,
        },
      },
    });
  }

  async generateShareUrl(type: string, itemId: string): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    switch (type) {
      case 'PRODUCT':
        return `${baseUrl}/products/${itemId}`;
      case 'COLLECTION':
        return `${baseUrl}/collections/${itemId}`;
      case 'WISHLIST':
        return `${baseUrl}/wishlist`;
      case 'ACHIEVEMENT':
        return `${baseUrl}/achievements/${itemId}`;
      default:
        return `${baseUrl}`;
    }
  }
}

