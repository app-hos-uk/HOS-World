import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CouponStatus,
  LoyaltyTxType,
  Prisma,
  PromotionStatus,
  PromotionType,
  SellerType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltySettingsService } from '../services/loyalty-settings.service';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';

export type BurnChannel = 'MARKETPLACE_CHECKOUT' | 'HOS_OUTLET_POS';

@Injectable()
export class LoyaltyBurnEngine {
  private readonly logger = new Logger(LoyaltyBurnEngine.name);

  constructor(
    private prisma: PrismaService,
    private wallet: LoyaltyWalletService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    @Optional() private loyaltySettings?: LoyaltySettingsService,
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

    const minRedeem = this.loyaltySettings
      ? (await this.loyaltySettings.getResolved()).settings.minRedemptionPoints
      : this.config.get<number>('LOYALTY_MIN_REDEMPTION_POINTS', 100);
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
        // Prior burn was reversed (points restored). Re-debit with a successor
        // wallet key and revive the same redemption — never heal without debit.
        if (prior?.status === 'REVERSED') {
          return this.redebitAfterReverse(tx, {
            membershipId: params.membershipId,
            points: params.points,
            channel: params.channel,
            storeId: params.storeId,
            prior,
            balance: membership.currentBalance,
          });
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
        if (existing?.status === 'REVERSED') {
          // Should have been handled above for callerBurnKey; refuse free heal.
          throw new BadRequestException(
            'Redemption was reversed — retry with voucherId or a new idempotency key',
          );
        }
        // Wallet burn applied but redemption row missing — heal using the wallet
        // sourceId (the id reserved at burn time), never a fresh UUID.
        const healId = priorWalletTx?.sourceId || redemptionId;
        const healed = await tx.loyaltyRedemption.create({
          data: {
            id: healId,
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
      // Only catalogue redemptions get a coupon. A checkout burn (orderId set)
      // already takes the discount off that order, so issuing a usable coupon on
      // top would hand out the reward twice.
      if (!params.orderId && option?.type === 'DISCOUNT' && option.value != null) {
        couponCode = await this.generateCouponCode(
          tx,
          option,
          params.membershipId,
          membership.userId,
        );
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

  /**
   * Issues the Promotion + Coupon pair that makes a DISCOUNT reward redeemable at
   * checkout (`PromotionsService.validateCoupon` resolves codes through `Coupon`).
   * A failure here must abort the whole redemption: returning a code with no
   * coupon row spends the member's points on something they can never apply.
   */
  private async generateCouponCode(
    tx: Prisma.TransactionClient,
    option: { id: string; value: any; type: string },
    membershipId: string,
    userId: string,
  ): Promise<string> {
    const { randomBytes } = await import('crypto');
    const amount = Number(option.value ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('This reward has no discount value configured');
    }

    // Pre-check uniqueness rather than recovering from a unique violation: a
    // failed insert aborts the surrounding transaction, so it cannot be retried.
    let code = '';
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = `HOS-LYL-${randomBytes(4).toString('hex').toUpperCase()}`;
      const clash = await tx.coupon.findUnique({ where: { code: candidate } });
      if (!clash) code = candidate;
    }
    if (!code) {
      throw new InternalServerErrorException(
        'Could not allocate a unique coupon code for this reward. No points were spent.',
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    try {
      const promotion = await tx.promotion.create({
        data: {
          name: `Loyalty reward ${code}`,
          description: `Loyalty redemption for membership ${membershipId} (option ${option.id})`,
          type: PromotionType.FIXED_DISCOUNT,
          status: PromotionStatus.ACTIVE,
          startDate: new Date(),
          endDate: expiresAt,
          // allowedUserId keeps the reward with the member who paid points for it:
          // PromotionsService refuses the code for any other account.
          conditions: { allowedUserId: userId } as Prisma.InputJsonValue,
          actions: { fixedAmount: amount } as Prisma.InputJsonValue,
          usageLimit: 1,
          userUsageLimit: 1,
        },
      });
      await tx.coupon.create({
        data: {
          code,
          promotionId: promotion.id,
          usageLimit: 1,
          userLimit: 1,
          expiresAt,
          status: CouponStatus.ACTIVE,
        },
      });
    } catch (e) {
      this.logger.error(
        `Coupon issue failed for redemption option ${option.id}: ${(e as Error).message}`,
      );
      throw new InternalServerErrorException(
        'Could not issue the reward coupon. No points were spent — please try again.',
      );
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
  private async findRedemptionByWalletKey(tx: Prisma.TransactionClient, idempotencyKey: string) {
    const walletTx = await tx.loyaltyTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (!walletTx?.sourceId) return null;
    return tx.loyaltyRedemption.findUnique({ where: { id: walletTx.sourceId } });
  }

  /**
   * After a POS voucher issue failure reversed the burn, a retry with the same
   * caller idempotency key must re-debit points (new wallet key) and revive the
   * same redemption id so voucher clientId stays stable.
   */
  private async redebitAfterReverse(
    tx: Prisma.TransactionClient,
    params: {
      membershipId: string;
      points: number;
      channel: BurnChannel;
      storeId?: string | null;
      prior: { id: string; couponCode: string | null };
      balance: number;
    },
  ): Promise<{ redemptionId: string; couponCode?: string }> {
    const redebitKey = `burn:redebit:${params.prior.id}`;
    const priorRedebit = await tx.loyaltyTransaction.findUnique({
      where: { idempotencyKey: redebitKey },
    });
    if (!priorRedebit && params.balance < params.points) {
      throw new BadRequestException('Insufficient points balance');
    }

    const result = await this.wallet.applyDelta(
      tx,
      params.membershipId,
      -params.points,
      LoyaltyTxType.BURN,
      {
        source: 'REDEMPTION_REDEBIT',
        sourceId: params.prior.id,
        channel: params.channel,
        storeId: params.storeId ?? undefined,
        description: 'Re-debit after reversed POS voucher burn',
        metadata: { priorRedemptionId: params.prior.id },
        idempotencyKey: redebitKey,
      },
    );

    if (result.applied) {
      await tx.loyaltyMembership.update({
        where: { id: params.membershipId },
        data: { totalPointsRedeemed: { increment: params.points } },
      });
    }

    await tx.loyaltyRedemption.update({
      where: { id: params.prior.id },
      data: { status: 'COMPLETED' },
    });

    return {
      redemptionId: params.prior.id,
      couponCode: params.prior.couponCode ?? undefined,
    };
  }
}
