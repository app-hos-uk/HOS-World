import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltyCampaignService } from '../services/campaign.service';
import { LoyaltyTierEngine } from './tier.engine';
import { BrandPartnershipsService } from '../../brand-partnerships/brand-partnerships.service';

@Injectable()
export class LoyaltyEarnEngine {
  private readonly logger = new Logger(LoyaltyEarnEngine.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wallet: LoyaltyWalletService,
    private campaigns: LoyaltyCampaignService,
    private tiers: LoyaltyTierEngine,
    private brandPartnerships: BrandPartnershipsService,
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
    const lines: Array<{
      productId: string;
      fandom?: string | null;
      brand?: string | null;
      categoryId?: string | null;
      lineBase: number;
    }> = [];

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
      lines.push({
        productId: p.id,
        fandom: p.fandom,
        brand: p.brand,
        categoryId: p.categoryId,
        lineBase: pts.toNumber(),
      });
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
    const { points: campPoints, campaignId, mult: internalMult, bonus: internalBonus } =
      this.campaigns.applyCampaignsToBasePoints(activeCampaigns, basePoints.toNumber());

    const applyTierMult = purchaseRule?.multiplierStack !== false;
    const tierMult =
      applyTierMult && membership.tier?.multiplier ? membership.tier.multiplier.toNumber() : 1;

    const tierLevel = membership.tier?.level ?? 0;
    const orderTotalNum = new Decimal(order.subtotal).toNumber();

    const primarySellerId = sellerIds.length === 1 ? sellerIds[0] : undefined;

    try {
      let brandCampaignId: string | undefined;
      let totalFinal = 0;

      await this.prisma.$transaction(async (tx) => {
        const brandBoost = await this.brandPartnerships.applyBrandOrderBoostInTx(tx, {
          userId: order.userId,
          tierLevel,
          regionCode: region,
          orderId: order.id,
          orderTotal: orderTotalNum,
          lines,
          internalMult,
          internalBonus,
        });

        const brandDelta = brandBoost.brandPoints;
        brandCampaignId = brandBoost.campaignId;

        const totalPre = campPoints + brandDelta;
        totalFinal = Math.max(0, Math.round(totalPre * tierMult));
        const internalFinal = Math.max(0, Math.round(campPoints * tierMult));
        const brandFinal = Math.max(0, totalFinal - internalFinal);

        if (totalFinal === 0) {
          return;
        }

        if (internalFinal > 0) {
          await this.wallet.applyDelta(tx, membership.id, internalFinal, LoyaltyTxType.EARN, {
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
        }

        if (brandFinal > 0 && brandBoost.campaignId) {
          await this.wallet.applyDelta(tx, membership.id, brandFinal, LoyaltyTxType.EARN, {
            source: 'BRAND_CAMPAIGN',
            sourceId: order.id,
            channel: 'WEB',
            sellerId: primarySellerId,
            earnRuleId: purchaseRule?.id ?? undefined,
            campaignId: brandBoost.campaignId,
            description: `Brand promotion: ${brandBoost.campaignName ?? ''}`.trim(),
            metadata: {
              orderNumber: order.orderNumber,
              partnerName: brandBoost.partnerName,
              campaignName: brandBoost.campaignName,
              brandMultiplier: brandBoost.brandMultiplier,
            } as Prisma.InputJsonValue,
          });
        }

        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: totalFinal },
            totalSpend: { increment: order.subtotal },
            purchaseCount: { increment: 1 },
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { loyaltyPointsEarned: totalFinal },
        });
      });

      if (totalFinal === 0) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { loyaltyPointsEarned: 0 },
        });
        return;
      }

      await this.brandPartnerships.reconcileAfterOrder(brandCampaignId);
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
    const lines: Array<{
      productId: string;
      fandom?: string | null;
      brand?: string | null;
      categoryId?: string | null;
      lineBase: number;
    }> = [];

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
      lines.push({
        productId: p.id,
        fandom: p.fandom,
        brand: p.brand,
        categoryId: p.categoryId,
        lineBase: pts.toNumber(),
      });
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
    const { points: campPoints, campaignId, mult: internalMult, bonus: internalBonus } =
      this.campaigns.applyCampaignsToBasePoints(activeCampaigns, basePoints.toNumber());

    const applyTierMult = purchaseRule?.multiplierStack !== false;
    const tierMult =
      applyTierMult && membership.tier?.multiplier ? membership.tier.multiplier.toNumber() : 1;

    const tierLevel = membership.tier?.level ?? 0;
    const primarySellerId = sellerIds.length === 1 ? sellerIds[0] : undefined;
    const subtotal = sale.items.reduce(
      (acc, i) => acc.add(new Decimal(i.unitPrice).mul(i.quantity)),
      new Decimal(0),
    );
    const orderTotalNum = subtotal.toNumber();

    try {
      let brandCampaignId: string | undefined;
      let totalFinal = 0;

      await this.prisma.$transaction(async (tx) => {
        const brandBoost = await this.brandPartnerships.applyBrandOrderBoostInTx(tx, {
          userId: sale.customerId,
          tierLevel,
          regionCode: region,
          orderId: sale.id,
          orderTotal: orderTotalNum,
          lines,
          internalMult,
          internalBonus,
        });

        const brandDelta = brandBoost.brandPoints;
        brandCampaignId = brandBoost.campaignId;

        const totalPre = campPoints + brandDelta;
        totalFinal = Math.max(0, Math.round(totalPre * tierMult));
        const internalFinal = Math.max(0, Math.round(campPoints * tierMult));
        const brandFinal = Math.max(0, totalFinal - internalFinal);

        if (totalFinal === 0) {
          return;
        }

        if (internalFinal > 0) {
          await this.wallet.applyDelta(tx, membership.id, internalFinal, LoyaltyTxType.EARN, {
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
        }

        if (brandFinal > 0 && brandBoost.campaignId) {
          await this.wallet.applyDelta(tx, membership.id, brandFinal, LoyaltyTxType.EARN, {
            source: 'BRAND_CAMPAIGN',
            sourceId: sale.id,
            channel: 'HOS_OUTLET_POS',
            storeId: sale.storeId,
            sellerId: primarySellerId,
            earnRuleId: purchaseRule?.id ?? undefined,
            campaignId: brandBoost.campaignId,
            description: `Brand promotion: ${brandBoost.campaignName ?? ''}`.trim(),
            metadata: {
              externalSaleId: sale.externalSaleId,
              partnerName: brandBoost.partnerName,
              campaignName: brandBoost.campaignName,
              brandMultiplier: brandBoost.brandMultiplier,
            } as Prisma.InputJsonValue,
          });
        }

        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: totalFinal },
            totalSpend: { increment: subtotal },
            purchaseCount: { increment: 1 },
          },
        });

        await tx.pOSSale.update({
          where: { id: sale.id },
          data: { loyaltyPointsEarned: totalFinal },
        });
      });

      if (totalFinal === 0) {
        await this.prisma.pOSSale.update({
          where: { id: sale.id },
          data: { loyaltyPointsEarned: 0 },
        });
        return;
      }

      await this.brandPartnerships.reconcileAfterOrder(brandCampaignId);
      await this.tiers.recalculateTier(membership.id);
    } catch (e) {
      this.logger.warn(`Loyalty earn failed for POS sale ${sale.id}: ${(e as Error).message}`);
    }
  }
}
