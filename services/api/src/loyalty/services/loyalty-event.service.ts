import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { MarketingEventBus } from '../../journeys/marketing-event.bus';

@Injectable()
export class LoyaltyEventService {
  private readonly logger = new Logger(LoyaltyEventService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private config?: ConfigService,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
  ) {}

  async onTierChange(params: {
    membershipId: string;
    userId: string;
    oldTierName: string;
    newTierName: string;
    oldTierLevel: number;
    newTierLevel: number;
  }): Promise<void> {
    const upgraded = params.newTierLevel > params.oldTierLevel;
    const notificationType = upgraded ? 'LOYALTY_TIER_UPGRADE' : 'LOYALTY_TIER_DOWNGRADE';
    const subject = upgraded
      ? `Congratulations! You've reached ${params.newTierName}`
      : `Your tier has changed to ${params.newTierName}`;
    const content = upgraded
      ? `You've been promoted from ${params.oldTierName} to ${params.newTierName}! Enjoy your new benefits.`
      : `Your tier has moved from ${params.oldTierName} to ${params.newTierName}. Keep earning to level up!`;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      });
      if (user) {
        await this.prisma.notification.create({
          data: {
            userId: params.userId,
            type: notificationType as any,
            subject,
            content,
            email: user.email,
            status: 'PENDING' as any,
            metadata: {
              oldTier: params.oldTierName,
              newTier: params.newTierName,
              membershipId: params.membershipId,
            },
          },
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to create tier-change notification: ${(e as Error).message}`);
    }

    try {
      await this.prisma.activityLog.create({
        data: {
          userId: params.userId,
          action: upgraded ? 'LOYALTY_TIER_UPGRADE' : 'LOYALTY_TIER_DOWNGRADE',
          entityType: 'LoyaltyMembership',
          entityId: params.membershipId,
          description: `Tier changed from ${params.oldTierName} to ${params.newTierName}`,
          metadata: {
            oldTier: params.oldTierName,
            newTier: params.newTierName,
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to log tier-change activity: ${(e as Error).message}`);
    }

    if (upgraded) {
      const minAmb = Number(this.config?.get<string>('AMBASSADOR_MIN_TIER_LEVEL', '4') ?? '4');
      const ambassadorEligible = params.newTierLevel >= minAmb;
      void this.marketingBus
        ?.emit('LOYALTY_TIER_UPGRADE', params.userId, {
          oldTier: params.oldTierName,
          newTier: params.newTierName,
          membershipId: params.membershipId,
          ambassadorEligible,
        })
        .catch(() => {});
    }
  }

  async onWelcome(userId: string, tierName: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (user) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'LOYALTY_WELCOME' as any,
            subject: 'Welcome to The Enchanted Circle!',
            content: `Welcome${user.firstName ? ` ${user.firstName}` : ''}! You've joined The Enchanted Circle at the ${tierName} tier. Start earning points today.`,
            email: user.email,
            status: 'PENDING' as any,
          },
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to send welcome notification: ${(e as Error).message}`);
    }
  }

  async onPointsEarned(userId: string, points: number, source: string): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'LOYALTY_POINTS_EARNED' as any,
          subject: `You earned ${points} Enchanted Circle points`,
          content: `${points} points have been added to your balance from ${source}.`,
          status: 'PENDING' as any,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to send points-earned notification: ${(e as Error).message}`);
    }
  }
}
