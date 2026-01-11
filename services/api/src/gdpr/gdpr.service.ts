import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface ConsentData {
  marketing?: boolean;
  analytics?: boolean;
  essential?: boolean;
  [key: string]: boolean | undefined;
}

@Injectable()
export class GDPRService {
  private readonly logger = new Logger(GDPRService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Grant or revoke GDPR consent
   */
  async updateConsent(
    userId: string,
    consentData: ConsentData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user consent
    const dataProcessingConsent = {
      ...((user.dataProcessingConsent as ConsentData) || {}),
      ...consentData,
    };

    const hasAnyConsent = Object.values(consentData).some((v) => v === true);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gdprConsent: hasAnyConsent,
        gdprConsentDate: hasAnyConsent ? new Date() : user.gdprConsentDate,
        dataProcessingConsent,
      },
    });

    // Log consent changes
    for (const [consentType, granted] of Object.entries(consentData)) {
      if (granted !== undefined) {
        await this.prisma.gDPRConsentLog.create({
          data: {
            userId,
            consentType: consentType.toUpperCase(),
            granted,
            grantedAt: new Date(),
            ipAddress,
            userAgent,
          },
        });
      }
    }
  }

  /**
   * Get user's consent status
   */
  async getConsent(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        gdprConsent: true,
        gdprConsentDate: true,
        dataProcessingConsent: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      gdprConsent: user.gdprConsent,
      gdprConsentDate: user.gdprConsentDate,
      dataProcessingConsent: user.dataProcessingConsent || {},
    };
  }

  /**
   * Get consent history
   */
  async getConsentHistory(userId: string): Promise<any[]> {
    const logs = await this.prisma.gDPRConsentLog.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });

    return logs;
  }

  /**
   * Export user data (GDPR Article 15)
   */
  async exportUserData(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        orders: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        reviews: true,
        wishlistItems: {
          include: {
            product: true,
          },
        },
        collections: true,
        userBadges: {
          include: {
            badge: true,
          },
        },
        userQuests: {
          include: {
            quest: true,
          },
        },
        aiChats: true,
        customerProfile: true,
        sellerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove sensitive data
    const exportData = {
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        country: user.country,
        createdAt: user.createdAt,
      },
      addresses: user.addresses,
      orders: user.orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        currency: order.currency,
        createdAt: order.createdAt,
        items: order.items,
      })),
      reviews: user.reviews,
      wishlist: user.wishlistItems,
      collections: user.collections,
      badges: user.userBadges,
      quests: user.userQuests,
      gamification: {
        points: user.gamificationPoints,
        level: user.level,
      },
      consent: {
        gdprConsent: user.gdprConsent,
        gdprConsentDate: user.gdprConsentDate,
        dataProcessingConsent: user.dataProcessingConsent,
      },
    };

    return exportData;
  }

  /**
   * Delete/anonymize user data (GDPR Article 17 - Right to be forgotten)
   */
  async deleteUserData(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Anonymize user data instead of hard delete (legal requirement for orders)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.local`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        avatar: null,
        password: '', // Invalidate password
        whatsappNumber: null,
        ipAddress: null,
        gdprConsent: false,
        dataProcessingConsent: null,
        // Keep country and currency for analytics (anonymized)
        // Keep orders for legal/compliance reasons
      },
    });

    // Delete non-essential data
    await this.prisma.collection.deleteMany({ where: { userId } });
    await this.prisma.sharedItem.deleteMany({ where: { userId } });
    await this.prisma.aIChat.deleteMany({ where: { userId } });
    await this.prisma.userBadge.deleteMany({ where: { userId } });
    await this.prisma.userQuest.deleteMany({ where: { userId } });
    await this.prisma.wishlistItem.deleteMany({ where: { userId } });
    await this.prisma.gDPRConsentLog.deleteMany({ where: { userId } });

    this.logger.log(`User data anonymized for user ${userId}`);
  }
}

