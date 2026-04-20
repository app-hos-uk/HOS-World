import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltyCampaignService } from '../services/campaign.service';
import { LoyaltyTierEngine } from './tier.engine';

@Injectable()
export class LoyaltyEarnEngine {
  private readonly logger = new Logger(LoyaltyEarnEngine.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wallet: LoyaltyWalletService,
    private campaigns: LoyaltyCampaignService,
    private tiers: LoyaltyTierEngine,
  ) {}

  /**
   * Resolve the "economic seller" for an order item, mirroring the checkout
   * VendorProduct routing so loyalty earn applies to the same seller that
   * receives the vendor ledger entry.
   */
  private async attachReferralFirstOrder(userId: string | null, orderId: string): Promise<void> {
    if (!userId) return;
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!m) return;
    await this.prisma.loyaltyReferral.updateMany({
      where: {
        refereeId: m.id,
        status: 'CONVERTED',
        convertedOrderId: null,
      },
      data: { convertedOrderId: orderId },
    });
  }

  private async resolveSellerForItem(
    product: { id: string; sellerId: string | null; isPlatformOwned: boolean; seller?: any },
    hosSellerId: string,
  ): Promise<{ id: string; loyaltyEnabled: boolean; loyaltyEarnRate: Prisma.Decimal | null } | null> {
    const activeVp = await this.prisma.vendorProduct.findFirst({
      where: { productId: product.id, status: 'ACTIVE' as any },
      select: { sellerId: true },
      orderBy: { vendorStock: 'desc' },
    });

    const effectiveSellerId =
      activeVp?.sellerId ||
      product.sellerId ||
      (product.isPlatformOwned && hosSellerId ? hosSellerId : null);

    if (!effectiveSellerId) return null;

    if (product.seller && product.seller.id === effectiveSellerId) {
      return product.seller;
    }
    return this.prisma.seller.findUnique({
      where: { id: effectiveSellerId },
      select: { id: true, loyaltyEnabled: true, loyaltyEarnRate: true },
    });
  }

  async processOrderComplete(orderId: string): Promise<void> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') {
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, parentOrderId: null },
      include: {
        items: {
          include: {
            product: { include: { seller: true } },
          },
        },
        user: true,
      },
    });

    if (!order?.userId || order.items.length === 0) return;
    if (order.loyaltyPointsEarned > 0) return;

    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId: order.userId },
      include: { tier: true },
    });
    if (!membership) return;

    const purchaseRule = await this.prisma.loyaltyEarnRule.findUnique({
      where: { action: 'PURCHASE' },
    });
    const platformDefaultRate = this.config.get<number>('LOYALTY_DEFAULT_EARN_RATE', 1);
    const hosSellerId = this.config.get<string>('HOS_SELLER_ID') || '';

    let basePoints = new Decimal(0);
    const sellerIds: string[] = [];

    for (const line of order.items) {
      const p = line.product;
      if (!p) continue;

      const seller = await this.resolveSellerForItem(p, hosSellerId);
      if (!seller?.loyaltyEnabled) continue;

      sellerIds.push(seller.id);
      const itemTotal = new Decimal(line.price).mul(line.quantity);

      let pts: Decimal;
      if (seller.loyaltyEarnRate != null) {
        pts = itemTotal.mul(new Decimal(seller.loyaltyEarnRate));
      } else if (purchaseRule?.pointsType === 'PER_CURRENCY_UNIT') {
        pts = itemTotal.mul(purchaseRule.pointsAmount);
      } else if (purchaseRule) {
        pts = new Decimal(purchaseRule.pointsAmount).mul(line.quantity);
      } else {
        pts = itemTotal.mul(platformDefaultRate);
      }

      basePoints = basePoints.add(pts);
    }

    if (basePoints.lte(0)) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { loyaltyPointsEarned: 0 },
      });
      return;
    }

    const region = membership.regionCode || order.user?.country || 'GB';
    const activeCampaigns = await this.campaigns.getActiveForContext(region, 'WEB');
    const { points: campPoints, campaignId } = this.campaigns.applyCampaignsToBasePoints(
      activeCampaigns,
      basePoints.toNumber(),
    );

    const applyTierMult = purchaseRule?.multiplierStack !== false;
    const tierMult =
      applyTierMult && membership.tier?.multiplier ? membership.tier.multiplier.toNumber() : 1;
    const finalPoints = Math.max(0, Math.round(campPoints * tierMult));

    if (finalPoints === 0) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { loyaltyPointsEarned: 0 },
      });
      return;
    }

    const primarySellerId = sellerIds.length === 1 ? sellerIds[0] : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, finalPoints, LoyaltyTxType.EARN, {
          source: 'PURCHASE',
          sourceId: order.id,
          channel: 'WEB',
          sellerId: primarySellerId,
          earnRuleId: purchaseRule?.id ?? undefined,
          campaignId: campaignId ?? undefined,
          description: 'Order purchase',
          metadata: {
            orderNumber: order.orderNumber,
            sellerIds,
          } as Prisma.InputJsonValue,
        });

        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: finalPoints },
            totalSpend: { increment: order.subtotal },
            purchaseCount: { increment: 1 },
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { loyaltyPointsEarned: finalPoints },
        });
      });

      await this.attachReferralFirstOrder(order.userId, order.id);
      await this.tiers.recalculateTier(membership.id);
    } catch (e) {
      this.logger.warn(`Loyalty earn failed for order ${order.id}: ${(e as Error).message}`);
    }
  }

  async processPosSale(posSaleId: string): Promise<void> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') {
      return;
    }

    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: posSaleId },
      include: {
        items: { include: { product: { include: { seller: true } } } },
        store: true,
      },
    });
    if (!sale?.customerId || sale.items.length === 0) return;
    if (sale.loyaltyPointsEarned > 0) return;

    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId: sale.customerId },
      include: { tier: true },
    });
    if (!membership) return;

    const purchaseRule = await this.prisma.loyaltyEarnRule.findUnique({
      where: { action: 'PURCHASE' },
    });
    const platformDefaultRate = this.config.get<number>('LOYALTY_DEFAULT_EARN_RATE', 1);
    const hosSellerId = this.config.get<string>('HOS_SELLER_ID') || '';

    let basePoints = new Decimal(0);
    const sellerIds: string[] = [];

    for (const line of sale.items) {
      const p = line.product;
      if (!p) continue;

      const seller = await this.resolveSellerForItem(p, hosSellerId);
      if (!seller?.loyaltyEnabled) continue;

      sellerIds.push(seller.id);
      const itemTotal = new Decimal(line.unitPrice).mul(line.quantity);

      let pts: Decimal;
      if (seller.loyaltyEarnRate != null) {
        pts = itemTotal.mul(new Decimal(seller.loyaltyEarnRate));
      } else if (purchaseRule?.pointsType === 'PER_CURRENCY_UNIT') {
        pts = itemTotal.mul(purchaseRule.pointsAmount);
      } else if (purchaseRule) {
        pts = new Decimal(purchaseRule.pointsAmount).mul(line.quantity);
      } else {
        pts = itemTotal.mul(platformDefaultRate);
      }

      basePoints = basePoints.add(pts);
    }

    if (basePoints.lte(0)) {
      await this.prisma.pOSSale.update({
        where: { id: sale.id },
        data: { loyaltyPointsEarned: 0 },
      });
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: sale.customerId } });
    const region = membership.regionCode || user?.country || 'GB';
    const activeCampaigns = await this.campaigns.getActiveForContext(region, 'HOS_OUTLET_POS');
    const { points: campPoints, campaignId } = this.campaigns.applyCampaignsToBasePoints(
      activeCampaigns,
      basePoints.toNumber(),
    );

    const applyTierMult = purchaseRule?.multiplierStack !== false;
    const tierMult =
      applyTierMult && membership.tier?.multiplier ? membership.tier.multiplier.toNumber() : 1;
    const finalPoints = Math.max(0, Math.round(campPoints * tierMult));

    if (finalPoints === 0) {
      await this.prisma.pOSSale.update({
        where: { id: sale.id },
        data: { loyaltyPointsEarned: 0 },
      });
      return;
    }

    const primarySellerId = sellerIds.length === 1 ? sellerIds[0] : undefined;
    const subtotal = sale.items.reduce(
      (acc, i) => acc.add(new Decimal(i.unitPrice).mul(i.quantity)),
      new Decimal(0),
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, finalPoints, LoyaltyTxType.EARN, {
          source: 'POS_PURCHASE',
          sourceId: sale.id,
          channel: 'HOS_OUTLET_POS',
          storeId: sale.storeId,
          sellerId: primarySellerId,
          earnRuleId: purchaseRule?.id ?? undefined,
          campaignId: campaignId ?? undefined,
          description: 'In-store purchase',
          metadata: {
            externalSaleId: sale.externalSaleId,
            sellerIds,
          } as Prisma.InputJsonValue,
        });

        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: finalPoints },
            totalSpend: { increment: subtotal },
            purchaseCount: { increment: 1 },
          },
        });

        await tx.pOSSale.update({
          where: { id: sale.id },
          data: { loyaltyPointsEarned: finalPoints },
        });
      });

      await this.tiers.recalculateTier(membership.id);
    } catch (e) {
      this.logger.warn(`Loyalty earn failed for POS sale ${sale.id}: ${(e as Error).message}`);
    }
  }
}
