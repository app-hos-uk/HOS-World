import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltyCampaignService } from '../services/campaign.service';
import { LoyaltyTierEngine } from './tier.engine';
import { BrandPartnershipsService } from '../../brand-partnerships/brand-partnerships.service';
import { ProductCampaignsService } from '../../product-campaigns/product-campaigns.service';

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
    private productCampaigns: ProductCampaignsService,
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

  /**
   * Split product-campaign (and optional C&C) points into one wallet line per campaign for attribution.
   * Rounding drift is absorbed by the last slice so the sum matches `productFinal`.
   */
  private async applyProductCampaignWalletSlices(
    tx: Prisma.TransactionClient,
    membershipId: string,
    productBoost: {
      breakdown: Array<{ campaignId: string; name: string; bonus: number }>;
      primaryCampaignId?: string;
      primaryCampaignName?: string;
    },
    productFinal: number,
    tierMult: number,
    ccBonusRaw: number,
    common: {
      sourceId: string;
      channel: string;
      sellerId?: string;
      earnRuleId?: string;
      storeId?: string;
      orderNumber?: string;
      externalSaleId?: string;
    },
  ): Promise<void> {
    if (productFinal <= 0) return;

    const slices: Array<{
      pts: number;
      campaignId?: string;
      description: string;
      metadata: Prisma.InputJsonValue;
    }> = [];

    for (const row of productBoost.breakdown) {
      const pts = Math.max(0, Math.round(row.bonus * tierMult));
      if (pts <= 0) continue;
      slices.push({
        pts,
        campaignId: row.campaignId,
        description: `Product campaign: ${row.name}`.trim(),
        metadata: {
          ...(common.orderNumber ? { orderNumber: common.orderNumber } : {}),
          ...(common.externalSaleId ? { externalSaleId: common.externalSaleId } : {}),
          breakdown: productBoost.breakdown,
          slice: { campaignId: row.campaignId, name: row.name, bonus: row.bonus },
        } as Prisma.InputJsonValue,
      });
    }

    if (ccBonusRaw > 0) {
      const pts = Math.max(0, Math.round(ccBonusRaw * tierMult));
      if (pts > 0) {
        slices.push({
          pts,
          description: 'Click & collect bonus',
          metadata: {
            ...(common.orderNumber ? { orderNumber: common.orderNumber } : {}),
            ccBonus: ccBonusRaw,
          } as Prisma.InputJsonValue,
        });
      }
    }

    if (!slices.length) {
      slices.push({
        pts: productFinal,
        campaignId: productBoost.primaryCampaignId,
        description: productBoost.primaryCampaignName
          ? `Product campaign: ${productBoost.primaryCampaignName}`.trim()
          : 'Product campaign',
        metadata: {
          ...(common.orderNumber ? { orderNumber: common.orderNumber } : {}),
          ...(common.externalSaleId ? { externalSaleId: common.externalSaleId } : {}),
          breakdown: productBoost.breakdown,
        } as Prisma.InputJsonValue,
      });
    }

    const sumPre = slices.reduce((s, x) => s + x.pts, 0);
    const drift = productFinal - sumPre;
    if (slices.length && drift !== 0) {
      slices[slices.length - 1].pts += drift;
    }

    for (const s of slices) {
      if (s.pts <= 0) continue;
      await this.wallet.applyDelta(tx, membershipId, s.pts, LoyaltyTxType.EARN, {
        source: 'PRODUCT_CAMPAIGN',
        sourceId: common.sourceId,
        channel: common.channel,
        storeId: common.storeId ?? null,
        sellerId: common.sellerId ?? null,
        earnRuleId: common.earnRuleId ?? undefined,
        campaignId: s.campaignId ?? null,
        description: s.description,
        metadata: s.metadata,
      });
    }
  }

  /**
   * When payment credited loyalty before click & collect existed, apply configured C&C bonus once.
   */
  async applyDeferredClickCollectBonus(orderId: string): Promise<void> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') {
      return;
    }
    if (this.config.get<string>('CC_BONUS_POINTS', '0') === '0') {
      return;
    }
    const ccRaw = Number(this.config.get('CC_BONUS_POINTS', 0));
    if (!Number.isFinite(ccRaw) || ccRaw <= 0) return;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, parentOrderId: null },
      include: {
        clickCollect: { select: { id: true, ccLoyaltyBonusApplied: true } },
      },
    });
    if (!order?.userId || !order.clickCollect || order.clickCollect.ccLoyaltyBonusApplied) {
      return;
    }
    if (order.loyaltyPointsEarned <= 0) return;

    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId: order.userId },
      include: { tier: true },
    });
    if (!membership) return;

    const purchaseRule = await this.prisma.loyaltyEarnRule.findUnique({
      where: { action: 'PURCHASE' },
    });
    const applyTierMult = purchaseRule?.multiplierStack !== false;
    const tierMult =
      applyTierMult && membership.tier?.multiplier ? membership.tier.multiplier.toNumber() : 1;

    const pts = Math.max(0, Math.round(ccRaw * tierMult));
    if (pts <= 0) {
      await this.prisma.clickCollectOrder.update({
        where: { id: order.clickCollect.id },
        data: { ccLoyaltyBonusApplied: true },
      });
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, pts, LoyaltyTxType.EARN, {
          source: 'PRODUCT_CAMPAIGN',
          sourceId: order.id,
          channel: 'WEB',
          earnRuleId: purchaseRule?.id ?? undefined,
          description: 'Click & collect bonus (deferred)',
          metadata: {
            orderNumber: order.orderNumber,
            ccBonus: ccRaw,
            deferredClickCollect: true,
          } as Prisma.InputJsonValue,
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: { totalPointsEarned: { increment: pts } },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { loyaltyPointsEarned: { increment: pts } },
        });
        await tx.clickCollectOrder.update({
          where: { id: order.clickCollect!.id },
          data: { ccLoyaltyBonusApplied: true },
        });
      });
      await this.tiers.recalculateTier(membership.id);
    } catch (e) {
      this.logger.error(
        `Deferred click & collect bonus failed for order ${orderId}`,
        (e as Error)?.stack ?? String(e),
      );
    }
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
        clickCollect: { select: { id: true, ccLoyaltyBonusApplied: true } },
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
      quantity: number;
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
        quantity: line.quantity,
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
    const ccBonus =
      order.clickCollect &&
      !order.clickCollect.ccLoyaltyBonusApplied &&
      this.config.get<string>('CC_BONUS_POINTS', '0') !== '0'
        ? Number(this.config.get('CC_BONUS_POINTS', 0))
        : 0;

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

        const productBoost = await this.productCampaigns.applyProductCampaignBonusInTx(tx, {
          tierLevel,
          regionCode: region,
          lines: lines.map((l) => ({
            productId: l.productId,
            fandom: l.fandom,
            categoryId: l.categoryId,
            quantity: l.quantity ?? 1,
          })),
        });

        const productDelta = productBoost.points + ccBonus;

        const totalPre = campPoints + brandDelta + productDelta;
        totalFinal = Math.max(0, Math.round(totalPre * tierMult));
        const internalFinal = Math.max(0, Math.round(campPoints * tierMult));
        const productFinal = Math.max(0, Math.round(productDelta * tierMult));
        const brandFinal = Math.max(0, totalFinal - internalFinal - productFinal);

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

        if (productFinal > 0 && (productBoost.points > 0 || ccBonus > 0)) {
          await this.applyProductCampaignWalletSlices(
            tx,
            membership.id,
            productBoost,
            productFinal,
            tierMult,
            ccBonus,
            {
              sourceId: order.id,
              channel: 'WEB',
              sellerId: primarySellerId,
              earnRuleId: purchaseRule?.id ?? undefined,
              orderNumber: order.orderNumber,
            },
          );
        }

        if (ccBonus > 0 && order.clickCollect?.id) {
          await tx.clickCollectOrder.update({
            where: { id: order.clickCollect.id },
            data: { ccLoyaltyBonusApplied: true },
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
      this.logger.error(
        `Loyalty earn failed for order ${order.id}: ${(e as Error).message}`,
        (e as Error)?.stack,
      );
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
      quantity: number;
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
        quantity: line.quantity,
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

        const productBoost = await this.productCampaigns.applyProductCampaignBonusInTx(tx, {
          tierLevel,
          regionCode: region,
          lines: lines.map((l) => ({
            productId: l.productId,
            fandom: l.fandom,
            categoryId: l.categoryId,
            quantity: l.quantity ?? 1,
          })),
        });

        const productDelta = productBoost.points;

        const totalPre = campPoints + brandDelta + productDelta;
        totalFinal = Math.max(0, Math.round(totalPre * tierMult));
        const internalFinal = Math.max(0, Math.round(campPoints * tierMult));
        const productFinal = Math.max(0, Math.round(productDelta * tierMult));
        const brandFinal = Math.max(0, totalFinal - internalFinal - productFinal);

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

        if (productFinal > 0 && productBoost.breakdown.length > 0) {
          await this.applyProductCampaignWalletSlices(
            tx,
            membership.id,
            productBoost,
            productFinal,
            tierMult,
            0,
            {
              sourceId: sale.id,
              channel: 'HOS_OUTLET_POS',
              storeId: sale.storeId,
              sellerId: primarySellerId,
              earnRuleId: purchaseRule?.id ?? undefined,
              externalSaleId: sale.externalSaleId ?? undefined,
            },
          );
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
      this.logger.error(
        `Loyalty earn failed for POS sale ${sale.id}: ${(e as Error).message}`,
        (e as Error)?.stack,
      );
    }
  }
}
