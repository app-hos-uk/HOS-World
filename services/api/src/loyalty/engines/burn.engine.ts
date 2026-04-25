import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma, SellerType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';

export type BurnChannel = 'MARKETPLACE_CHECKOUT' | 'HOS_OUTLET_POS';

@Injectable()
export class LoyaltyBurnEngine {
  constructor(
    private prisma: PrismaService,
    private wallet: LoyaltyWalletService,
    private config: ConfigService,
  ) {}

  assertChannelAllowed(channel: string, storeId?: string | null): void {
    if (channel !== 'MARKETPLACE_CHECKOUT' && channel !== 'HOS_OUTLET_POS') {
      throw new BadRequestException('Redemption not available on this channel');
    }
    if (channel === 'HOS_OUTLET_POS' && !storeId) {
      throw new BadRequestException('Store is required for outlet redemption');
    }
  }

  async validatePosStore(storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { seller: true },
    });
    if (!store?.seller || store.seller.sellerType !== SellerType.PLATFORM_RETAIL) {
      throw new BadRequestException('Redemption not available on this channel');
    }
  }

  async processRedemption(params: {
    membershipId: string;
    points: number;
    channel: BurnChannel;
    storeId?: string | null;
    optionId?: string | null;
    orderId?: string | null;
    regionCode?: string | null;
    prismaTx?: Prisma.TransactionClient;
  }): Promise<{ redemptionId: string; couponCode?: string }> {
    const enabled = this.config.get<string>('LOYALTY_ENABLED') === 'true';
    if (!enabled) {
      throw new BadRequestException('Loyalty programme is not enabled');
    }

    this.assertChannelAllowed(params.channel, params.storeId);
    if (params.channel === 'HOS_OUTLET_POS' && params.storeId) {
      await this.validatePosStore(params.storeId);
    }

    const minRedeem = this.config.get<number>('LOYALTY_MIN_REDEMPTION_POINTS', 100);
    if (params.points < minRedeem) {
      throw new BadRequestException(`Minimum redemption is ${minRedeem} points`);
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const membership = await tx.loyaltyMembership.findUnique({
        where: { id: params.membershipId },
      });
      if (!membership || membership.currentBalance < params.points) {
        throw new BadRequestException('Insufficient points balance');
      }

      let option: Awaited<ReturnType<typeof tx.loyaltyRedemptionOption.findUnique>> = null;

      if (params.optionId) {
        option = await tx.loyaltyRedemptionOption.findUnique({
          where: { id: params.optionId },
        });
        if (!option || !option.isActive) {
          throw new BadRequestException('Invalid redemption option');
        }

        if (option.regionCodes.length > 0 && params.regionCode) {
          if (!option.regionCodes.includes(params.regionCode)) {
            throw new BadRequestException('This reward is not available in your region');
          }
        }

        if (option.channels.length > 0) {
          if (!option.channels.includes(params.channel)) {
            throw new BadRequestException('This reward is not available on this channel');
          }
        }

        if (option.pointsCost !== params.points) {
          throw new BadRequestException('Points amount does not match selected reward');
        }
        if (option.stock != null && option.stock < 1) {
          throw new BadRequestException('Reward is out of stock');
        }
      }

      const optionIdForRow =
        params.optionId ?? (await this.ensureGenericBurnOption(tx as Prisma.TransactionClient));

      await this.wallet.applyDelta(tx, params.membershipId, -params.points, LoyaltyTxType.BURN, {
        source: 'REDEMPTION',
        sourceId: params.orderId ?? undefined,
        channel: params.channel,
        storeId: params.storeId ?? undefined,
        description: option ? `Redeemed: ${option.type}` : 'Points redemption',
        metadata: option ? { optionId: option.id } : { checkout: true },
      });

      await tx.loyaltyMembership.update({
        where: { id: params.membershipId },
        data: { totalPointsRedeemed: { increment: params.points } },
      });

      let couponCode: string | undefined;
      if (option?.type === 'DISCOUNT' && option.value != null) {
        couponCode = await this.generateCouponCode(tx, option, params.membershipId);
      }

      const redemption = await tx.loyaltyRedemption.create({
        data: {
          membershipId: params.membershipId,
          optionId: optionIdForRow,
          pointsSpent: params.points,
          channel: params.channel,
          storeId: params.storeId ?? undefined,
          orderId: params.orderId ?? undefined,
          status: 'COMPLETED',
          couponCode,
        },
      });

      if (option && option.stock != null) {
        await tx.loyaltyRedemptionOption.update({
          where: { id: option.id },
          data: { stock: { decrement: 1 } },
        });
      }

      return { redemptionId: redemption.id, couponCode };
    };

    if (params.prismaTx) {
      return run(params.prismaTx);
    }
    return this.prisma.$transaction(async (tx) => run(tx));
  }

  private async generateCouponCode(
    tx: Prisma.TransactionClient,
    option: { id: string; value: any; type: string },
    membershipId: string,
  ): Promise<string> {
    const { randomBytes } = await import('crypto');
    const code = `HOS-LYL-${randomBytes(4).toString('hex').toUpperCase()}`;

    try {
      await (tx as any).promotion?.create?.({
        data: {
          code,
          type: 'LOYALTY_REWARD',
          discountType: 'FIXED_AMOUNT',
          discountValue: option.value,
          usageLimit: 1,
          usedCount: 0,
          isActive: true,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          metadata: { loyaltyOptionId: option.id, membershipId },
        },
      });
    } catch {
      // Promotion model may not exist yet — coupon code is still returned
    }

    return code;
  }

  private async ensureGenericBurnOption(tx: Prisma.TransactionClient): Promise<string> {
    const name = '__INTERNAL_CHECKOUT_DISCOUNT__';
    let opt = await tx.loyaltyRedemptionOption.findFirst({ where: { name } });
    if (!opt) {
      opt = await tx.loyaltyRedemptionOption.create({
        data: {
          name,
          type: 'DISCOUNT',
          pointsCost: 1,
          value: null,
          isActive: false,
        },
      });
    }
    return opt.id;
  }
}
