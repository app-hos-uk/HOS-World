import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma, SellerType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';

export type BurnChannel = 'MARKETPLACE_CHECKOUT' | 'HOS_OUTLET_POS';

@Injectable()
export class LoyaltyBurnEngine {
  constructor(
    private prisma: PrismaService,
    private wallet: LoyaltyWalletService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
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
    /** When set with HOS_OUTLET_POS, increments POSSale.loyaltyPointsRedeemed. */
    posSaleId?: string | null;
    regionCode?: string | null;
    /**
     * Caller-supplied replay key for burns with no orderId (e.g. POS terminal + till sale ref).
     * A repeated call returns the original redemption instead of burning again.
     */
    idempotencyKey?: string | null;
    prismaTx?: Prisma.TransactionClient;
  }): Promise<{ redemptionId: string; couponCode?: string }> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
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
      if (!membership) {
        throw new NotFoundException('Loyalty membership not found');
      }

      // Idempotent replay: return the prior redemption before balance / wallet work.
      const callerBurnKey = params.idempotencyKey
        ? `burn:key:${params.membershipId}:${params.idempotencyKey}`
        : null;
      if (params.orderId) {
        const prior = await this.findCompletedOrderRedemption(
          tx,
          params.membershipId,
          params.orderId,
        );
        if (prior) {
          return {
            redemptionId: prior.id,
            couponCode: prior.couponCode ?? undefined,
          };
        }
      } else if (callerBurnKey) {
        const prior = await this.findRedemptionByWalletKey(tx, callerBurnKey);
        if (prior && prior.status !== 'REVERSED') {
          return {
            redemptionId: prior.id,
            couponCode: prior.couponCode ?? undefined,
          };
        }
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

      const redemptionId = randomUUID();
      const idempotencyKey = params.orderId
        ? `burn:order:${params.orderId}:${params.optionId ?? optionIdForRow}`
        : (callerBurnKey ?? `burn:${redemptionId}`);

      // Skip balance gate when wallet already recorded this burn (retry after debit).
      // Only order/caller keys are deterministic; `burn:${redemptionId}` can never pre-exist.
      const priorWalletTx =
        params.orderId || callerBurnKey
          ? await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey } })
          : null;
      if (!priorWalletTx && membership.currentBalance < params.points) {
        throw new BadRequestException('Insufficient points balance');
      }

      const deltaResult = await this.wallet.applyDelta(
        tx,
        params.membershipId,
        -params.points,
        LoyaltyTxType.BURN,
        {
          source: 'REDEMPTION',
          sourceId: params.orderId ?? redemptionId,
          channel: params.channel,
          storeId: params.storeId ?? undefined,
          description: option ? `Redeemed: ${option.type}` : 'Points redemption',
          metadata: option ? { optionId: option.id } : { checkout: true },
          idempotencyKey,
        },
      );

      if (!deltaResult.applied) {
        const existing = params.orderId
          ? await this.findCompletedOrderRedemption(tx, params.membershipId, params.orderId)
          : await this.findRedemptionByWalletKey(tx, idempotencyKey);
        if (existing && existing.status !== 'REVERSED') {
          return {
            redemptionId: existing.id,
            couponCode: existing.couponCode ?? undefined,
          };
        }
        // Wallet burn already applied but redemption row missing — heal once, no coupon/stock.
        const healed = await tx.loyaltyRedemption.create({
          data: {
            id: redemptionId,
            membershipId: params.membershipId,
            optionId: optionIdForRow,
            pointsSpent: params.points,
            channel: params.channel,
            storeId: params.storeId ?? undefined,
            orderId: params.orderId ?? undefined,
            status: 'COMPLETED',
          },
        });
        return { redemptionId: healed.id };
      }

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
          id: redemptionId,
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

      // In-store burn: only stamp POSSale when caller supplies a concrete sale link.
      // Standalone outlet redemptions (no posSaleId) have no clear sale row to update.
      if (params.channel === 'HOS_OUTLET_POS' && params.posSaleId) {
        await tx.pOSSale.update({
          where: { id: params.posSaleId },
          data: { loyaltyPointsRedeemed: { increment: params.points } },
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

  private findCompletedOrderRedemption(
    tx: Prisma.TransactionClient,
    membershipId: string,
    orderId: string,
  ) {
    return tx.loyaltyRedemption.findFirst({
      where: {
        membershipId,
        orderId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resolve the redemption minted by an earlier burn carrying the same wallet key.
   * Non-order burns record `sourceId = redemptionId`, so the wallet row points back to it.
   * Returns the row whatever its status — a REVERSED redemption still has a voucher the
   * caller should retry rather than burning a second time.
   */
  private async findRedemptionByWalletKey(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
  ) {
    const walletTx = await tx.loyaltyTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (!walletTx?.sourceId) return null;
    return tx.loyaltyRedemption.findUnique({ where: { id: walletTx.sourceId } });
  }
}
