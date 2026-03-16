import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface ConsentData {
  marketing?: boolean;
  analytics?: boolean;
  essential?: boolean;
  doNotSell?: boolean;
  [key: string]: boolean | undefined;
}

export const CURRENT_PRIVACY_POLICY_VERSION = '2026-02-19-v1';

@Injectable()
export class GDPRService {
  private readonly logger = new Logger(GDPRService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Grant or revoke privacy consent (US Privacy / CCPA)
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

    const consent = (user.dataProcessingConsent as ConsentData) || {};

    return {
      gdprConsent: user.gdprConsent,
      gdprConsentDate: user.gdprConsentDate,
      dataProcessingConsent: consent,
      doNotSell: consent.doNotSell || false,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    };
  }

  /**
   * CCPA "Do Not Sell or Share My Personal Information" opt-out
   */
  async setDoNotSell(
    userId: string,
    optOut: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const current = (user.dataProcessingConsent as ConsentData) || {};
    const updated = { ...current, doNotSell: optOut };

    await this.prisma.user.update({
      where: { id: userId },
      data: { dataProcessingConsent: updated },
    });

    await this.prisma.gDPRConsentLog.create({
      data: {
        userId,
        consentType: 'DO_NOT_SELL',
        granted: optOut,
        grantedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    this.logger.log(`User ${userId} set doNotSell=${optOut}`);
  }

  /**
   * CCPA public opt-out by email (no auth required — required for CCPA compliance)
   */
  async setDoNotSellByEmail(
    email: string,
    optOut: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ updated: boolean }> {
    const normalizedEmail = email?.trim()?.toLowerCase();
    if (!normalizedEmail) {
      throw new NotFoundException('Email is required');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!user) {
      // Return success without revealing whether email exists (privacy best practice)
      this.logger.log(`Do-not-sell request for unknown email (optOut=${optOut})`);
      return { updated: false };
    }

    await this.setDoNotSell(user.id, optOut, ipAddress, userAgent);
    return { updated: true };
  }

  /**
   * Get a summary of all consent events for admin auditing
   */
  async getConsentAuditLog(page = 1, limit = 50): Promise<{ logs: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.gDPRConsentLog.findMany({
        skip,
        take: limit,
        orderBy: { grantedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.gDPRConsentLog.count(),
    ]);

    return { logs, total };
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
   * Export user data (CCPA right to know / data portability)
   */
  async exportUserData(userId: string, ipAddress?: string, userAgent?: string): Promise<any> {
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

    await this.prisma.gDPRConsentLog.create({
      data: {
        userId,
        consentType: 'DATA_EXPORT_REQUEST',
        granted: true,
        grantedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });
    this.logger.log(`Data export requested by user ${userId}`);

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
   * Delete/anonymize user data (CCPA right to deletion)
   */
  async deleteUserData(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Log the deletion request BEFORE anonymizing (audit trail survives the deletion)
    await this.prisma.gDPRConsentLog.create({
      data: {
        userId,
        consentType: 'ACCOUNT_DELETION_REQUEST',
        granted: true,
        grantedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    // Anonymize user data instead of hard delete (legal requirement for orders)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.local`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        avatar: null,
        password: '',
        whatsappNumber: null,
        ipAddress: null,
        gdprConsent: false,
        dataProcessingConsent: null,
      },
    });

    // Delete non-essential data (but KEEP consent logs for audit compliance)
    await this.prisma.collection.deleteMany({ where: { userId } });
    await this.prisma.sharedItem.deleteMany({ where: { userId } });
    await this.prisma.aIChat.deleteMany({ where: { userId } });
    await this.prisma.userBadge.deleteMany({ where: { userId } });
    await this.prisma.userQuest.deleteMany({ where: { userId } });
    await this.prisma.wishlistItem.deleteMany({ where: { userId } });

    this.logger.log(`User data anonymized for user ${userId}`);
  }
}
