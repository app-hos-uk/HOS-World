import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltyCampaignService } from '../services/campaign.service';
import { LoyaltyTierEngine } from './tier.engine';
import { BrandPartnershipsService } from '../../brand-partnerships/brand-partnerships.service';
import { ProductCampaignsService } from '../../product-campaigns/product-campaigns.service';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';
import { LoyaltySettingsService } from '../services/loyalty-settings.service';

@Injectable()
export class LoyaltyEarnEngine {
  private readonly logger = new Logger(LoyaltyEarnEngine.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private wallet: LoyaltyWalletService,
    private campaigns: LoyaltyCampaignService,
    private tiers: LoyaltyTierEngine,
    private brandPartnerships: BrandPartnershipsService,
    private productCampaigns: ProductCampaignsService,
    @Optional() private loyaltySettings?: LoyaltySettingsService,
  ) {}

  private async platformDefaultEarnRate(): Promise<number> {
    if (this.loyaltySettings) {
      const { settings } = await this.loyaltySettings.getResolved();
      return settings.defaultEarnRate || 0;
    }
    return Number(this.config.get('LOYALTY_DEFAULT_EARN_RATE', 1)) || 0;
  }

  /**
   * Auto-enroll a customer into loyalty on first qualifying earn if they have
   * no membership yet. Quiet (no welcome side-effects) so payment/POS paths
   * are not blocked by notification failures.
   */
  private async ensureMembershipForUser(userId: string) {
    const existing = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.CUSTOMER) return null;

    let tier = await this.prisma.loyaltyTier.findFirst({
      where: { slug: 'initiate', isActive: true },
    });
    if (!tier) {
      try {
        tier = await this.prisma.loyaltyTier.create({
          data: {
            name: 'Initiate',
            slug: 'initiate',
            level: 1,
            pointsThreshold: 0,
            multiplier: new Decimal(1),
            benefits: { freeShipping: false, earlyAccessHours: 0 },
            isActive: true,
          },
        });
      } catch {
        tier = await this.prisma.loyaltyTier.findFirst({
          where: { slug: 'initiate', isActive: true },
        });
      }
    }
    if (!tier) {
      this.logger.warn(`Cannot auto-enroll user ${userId}: Initiate tier missing`);
      return null;
    }

    const prefix = this.config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
    const cardNumber = `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    try {
      return await this.prisma.loyaltyMembership.create({
        data: {
          userId,
          tierId: tier.id,
          regionCode: user.country || 'GB',
          preferredCurrency: user.currencyPreference || 'USD',
          enrollmentChannel: 'AUTO_PURCHASE',
          cardNumber,
          birthday: user.birthday ?? undefined,
        },
        include: { tier: true },
      });
    } catch {
      // Concurrent enroll — return whatever now exists
      return this.prisma.loyaltyMembership.findUnique({
        where: { userId },
        include: { tier: true },
      });
    }
  }

  /**
   * Compute base points for a line. Seller.loyaltyEnabled gates seller-specific
   * earn rates only; platform PURCHASE rules / default rate still apply.
   */
  private computeLinePoints(
    itemTotal: Decimal,
    quantity: number,
    seller: { loyaltyEnabled: boolean; loyaltyEarnRate: Prisma.Decimal | null },
    purchaseRule: {
      isActive: boolean;
      pointsType: string;
      pointsAmount: number;
    } | null,
    platformDefaultRate: number,
  ): { pts: Decimal; skippedDisabledSeller: boolean } {
    if (seller.loyaltyEnabled && seller.loyaltyEarnRate != null) {
      return { pts: itemTotal.mul(new Decimal(seller.loyaltyEarnRate)), skippedDisabledSeller: false };
    }

    const platformRule =
      purchaseRule && purchaseRule.isActive !== false ? purchaseRule : null;

    if (platformRule?.pointsType === 'PER_CURRENCY_UNIT') {
      return { pts: itemTotal.mul(platformRule.pointsAmount), skippedDisabledSeller: false };
    }
    if (platformRule) {
      return {
        pts: new Decimal(platformRule.pointsAmount).mul(quantity),
        skippedDisabledSeller: false,
      };
    }

    // No active platform rule: only use default rate when seller participates,
    // or when a positive platform default is configured (platform-wide earn).
    if (seller.loyaltyEnabled || platformDefaultRate > 0) {
      return { pts: itemTotal.mul(platformDefaultRate), skippedDisabledSeller: false };
    }

    return { pts: new Decimal(0), skippedDisabledSeller: !seller.loyaltyEnabled };
  }

  /** Rounds points in Decimal so a half-way value is not lost to float error. */
  private roundPoints(raw: number, multiplier: number): number {
    return Math.max(
      0,
      new Decimal(raw).mul(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    );
  }

  /**
   * Apply the tier multiplier in Decimal, so an exact 2.5 cannot arrive as
   * 2.4999999999999996 and lose a point. Brand takes the residual so the three
   * slices always sum to the awarded total.
   */
  private applyTierMultiplier(
    parts: { internal: number; brand: number; product: number },
    tierMult: number,
  ): { totalFinal: number; internalFinal: number; productFinal: number; brandFinal: number } {
    const totalRaw = new Decimal(parts.internal).add(parts.brand).add(parts.product);
    const totalFinal = Math.max(
      0,
      totalRaw.mul(tierMult).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    );
    const internalFinal = this.roundPoints(parts.internal, tierMult);
    const productFinal = this.roundPoints(parts.product, tierMult);
    const brandFinal = Math.max(0, totalFinal - internalFinal - productFinal);

    return { totalFinal, internalFinal, productFinal, brandFinal };
  }

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
  ): Promise<number> {
    if (productFinal <= 0) return 0;

    const slices: Array<{
      pts: number;
      campaignId?: string;
      keySuffix: string;
      description: string;
      metadata: Prisma.InputJsonValue;
    }> = [];

    for (const row of productBoost.breakdown) {
      const pts = this.roundPoints(row.bonus, tierMult);
      if (pts <= 0) continue;
      slices.push({
        pts,
        campaignId: row.campaignId,
        keySuffix: row.campaignId,
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
      const pts = this.roundPoints(ccBonusRaw, tierMult);
      if (pts > 0) {
        slices.push({
          pts,
          keySuffix: 'cc',
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
        keySuffix: productBoost.primaryCampaignId ?? 'base',
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

    let appliedPoints = 0;
    for (const s of slices) {
      if (s.pts <= 0) continue;
      const result = await this.wallet.applyDelta(tx, membershipId, s.pts, LoyaltyTxType.EARN, {
        source: 'PRODUCT_CAMPAIGN',
        sourceId: common.sourceId,
        channel: common.channel,
        storeId: common.storeId ?? null,
        sellerId: common.sellerId ?? null,
        earnRuleId: common.earnRuleId ?? undefined,
        campaignId: s.campaignId ?? null,
        description: s.description,
        metadata: s.metadata,
        idempotencyKey: `earn:PRODUCT_CAMPAIGN:${common.sourceId}:${s.keySuffix}`,
      });
      if (result?.applied) appliedPoints += s.pts;
    }
    return appliedPoints;
  }

  /**
   * When payment credited loyalty before click & collect existed, apply configured C&C bonus once.
   */
  async applyDeferredClickCollectBonus(orderId: string): Promise<void> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
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

    const pts = this.roundPoints(ccRaw, tierMult);
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
          idempotencyKey: `earn:PRODUCT_CAMPAIGN:${order.id}:cc-deferred`,
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
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
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

    const membership = await this.ensureMembershipForUser(order.userId);
    if (!membership) return;

    const purchaseRule = await this.prisma.loyaltyEarnRule.findUnique({
      where: { action: 'PURCHASE' },
    });
    const platformDefaultRate = await this.platformDefaultEarnRate();
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

    let skippedDisabledSeller = 0;
    for (const line of order.items) {
      const p = line.product;
      if (!p) continue;

      const seller =
        (await this.resolveSellerForItem(p, hosSellerId)) ??
        // Unresolved seller: still apply platform PURCHASE rule / default rate
        { id: null as string | null, loyaltyEnabled: true, loyaltyEarnRate: null };

      if (seller.id) sellerIds.push(seller.id);
      const itemTotal = new Decimal(line.price).mul(line.quantity);
      const { pts, skippedDisabledSeller: skipped } = this.computeLinePoints(
        itemTotal,
        line.quantity,
        { loyaltyEnabled: seller.loyaltyEnabled, loyaltyEarnRate: seller.loyaltyEarnRate },
        purchaseRule,
        platformDefaultRate,
      );
      if (skipped) {
        skippedDisabledSeller++;
        continue;
      }
      if (pts.lte(0)) continue;

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
      if (skippedDisabledSeller > 0) {
        this.logger.warn(
          `Order ${order.id}: no loyalty earn — ${skippedDisabledSeller} line(s) from sellers with loyaltyEnabled=false`,
        );
      }
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

        const split = this.applyTierMultiplier(
          { internal: campPoints, brand: brandDelta, product: productDelta },
          tierMult,
        );
        totalFinal = split.totalFinal;
        const { internalFinal, productFinal, brandFinal } = split;

        if (totalFinal === 0) {
          return;
        }

        let appliedPoints = 0;

        if (internalFinal > 0) {
          const result = await this.wallet.applyDelta(
            tx,
            membership.id,
            internalFinal,
            LoyaltyTxType.EARN,
            {
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
              idempotencyKey: `earn:PURCHASE:${order.id}:${campaignId || 'base'}`,
            },
          );
          if (result?.applied) appliedPoints += internalFinal;
        }

        if (brandFinal > 0 && brandBoost.campaignId) {
          const result = await this.wallet.applyDelta(
            tx,
            membership.id,
            brandFinal,
            LoyaltyTxType.EARN,
            {
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
              idempotencyKey: `earn:BRAND_CAMPAIGN:${order.id}:${brandBoost.campaignId}`,
            },
          );
          if (result?.applied) appliedPoints += brandFinal;
        }

        if (productFinal > 0 && (productBoost.points > 0 || ccBonus > 0)) {
          appliedPoints += await this.applyProductCampaignWalletSlices(
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

        // Flag means "C&C bonus accounted for" — set it even when the slice was a
        // no-op, otherwise applyDeferredClickCollectBonus (different key) re-credits it.
        if (ccBonus > 0 && order.clickCollect?.id) {
          await tx.clickCollectOrder.update({
            where: { id: order.clickCollect.id },
            data: { ccLoyaltyBonusApplied: true },
          });
        }

        // Only bump membership stats for wallet writes that actually applied.
        if (appliedPoints > 0) {
          await tx.loyaltyMembership.update({
            where: { id: membership.id },
            data: {
              totalPointsEarned: { increment: appliedPoints },
              totalSpend: { increment: order.subtotal },
              purchaseCount: { increment: 1 },
            },
          });
        }

        // Always stamp the order so retries after a wallet-only success do not re-enter.
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
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
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

    const membership = await this.ensureMembershipForUser(sale.customerId);
    if (!membership) return;

    const purchaseRule = await this.prisma.loyaltyEarnRule.findUnique({
      where: { action: 'PURCHASE' },
    });
    const platformDefaultRate = await this.platformDefaultEarnRate();
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

    let skippedDisabledSeller = 0;
    for (const line of sale.items) {
      const p = line.product;
      if (!p) continue;

      const seller =
        (await this.resolveSellerForItem(p, hosSellerId)) ??
        { id: null as string | null, loyaltyEnabled: true, loyaltyEarnRate: null };

      if (seller.id) sellerIds.push(seller.id);
      const itemTotal = new Decimal(line.unitPrice).mul(line.quantity);
      const { pts, skippedDisabledSeller: skipped } = this.computeLinePoints(
        itemTotal,
        line.quantity,
        { loyaltyEnabled: seller.loyaltyEnabled, loyaltyEarnRate: seller.loyaltyEarnRate },
        purchaseRule,
        platformDefaultRate,
      );
      if (skipped) {
        skippedDisabledSeller++;
        continue;
      }
      if (pts.lte(0)) continue;

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
      if (skippedDisabledSeller > 0) {
        this.logger.warn(
          `POS sale ${sale.id}: no loyalty earn — ${skippedDisabledSeller} line(s) from sellers with loyaltyEnabled=false`,
        );
      }
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

        const split = this.applyTierMultiplier(
          { internal: campPoints, brand: brandDelta, product: productDelta },
          tierMult,
        );
        totalFinal = split.totalFinal;
        const { internalFinal, productFinal, brandFinal } = split;

        if (totalFinal === 0) {
          return;
        }

        let appliedPoints = 0;

        if (internalFinal > 0) {
          const result = await this.wallet.applyDelta(
            tx,
            membership.id,
            internalFinal,
            LoyaltyTxType.EARN,
            {
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
              idempotencyKey: `earn:POS_PURCHASE:${sale.id}:${campaignId || 'base'}`,
            },
          );
          if (result?.applied) appliedPoints += internalFinal;
        }

        if (brandFinal > 0 && brandBoost.campaignId) {
          const result = await this.wallet.applyDelta(
            tx,
            membership.id,
            brandFinal,
            LoyaltyTxType.EARN,
            {
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
              idempotencyKey: `earn:BRAND_CAMPAIGN:${sale.id}:${brandBoost.campaignId}`,
            },
          );
          if (result?.applied) appliedPoints += brandFinal;
        }

        if (productFinal > 0 && productBoost.breakdown.length > 0) {
          appliedPoints += await this.applyProductCampaignWalletSlices(
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

        if (appliedPoints > 0) {
          await tx.loyaltyMembership.update({
            where: { id: membership.id },
            data: {
              totalPointsEarned: { increment: appliedPoints },
              totalSpend: { increment: subtotal },
              purchaseCount: { increment: 1 },
            },
          });
        }

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
      // Re-throw so sales import can leave the sale as IMPORTED and retry earn later.
      throw e;
    }
  }

  /**
   * Claw back loyalty points when a previously processed POS sale is voided.
   * Idempotent via wallet key `reverse:POS_PURCHASE:{saleId}`.
   *
   * The debit is capped at the live balance: a member who already spent the
   * points must not block the void, so we take what is there and log the
   * shortfall (same policy as order cancellation).
   */
  async reversePosSaleEarn(posSaleId: string): Promise<void> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
      return;
    }

    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: posSaleId },
    });
    if (!sale?.customerId || sale.loyaltyPointsEarned <= 0) return;

    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId: sale.customerId },
    });
    if (!membership) return;

    const points = sale.loyaltyPointsEarned;
    let clawed = 0;
    await this.prisma.$transaction(async (tx) => {
      await this.wallet.lockMembership(tx, membership.id);
      const locked = await tx.loyaltyMembership.findUnique({
        where: { id: membership.id },
        select: { currentBalance: true, totalPointsEarned: true, purchaseCount: true },
      });
      clawed = Math.min(points, Math.max(0, locked?.currentBalance ?? 0));

      if (clawed > 0) {
        const result = await this.wallet.applyDelta(
          tx,
          membership.id,
          -clawed,
          LoyaltyTxType.ADJUST,
          {
            source: 'POS_SALE_VOID',
            sourceId: sale.id,
            channel: 'HOS_OUTLET_POS',
            storeId: sale.storeId,
            description: 'Clawback for voided POS sale',
            metadata: {
              externalSaleId: sale.externalSaleId,
              earnedPoints: points,
              clawedPoints: clawed,
            },
            idempotencyKey: `reverse:POS_PURCHASE:${sale.id}`,
          },
        );
        if (result.applied) {
          await tx.loyaltyMembership.update({
            where: { id: membership.id },
            data: {
              totalPointsEarned: {
                decrement: Math.min(clawed, locked?.totalPointsEarned ?? 0),
              },
            },
          });
        }
      }

      if ((locked?.purchaseCount ?? 0) > 0) {
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: { purchaseCount: { decrement: 1 } },
        });
      }

      await tx.pOSSale.update({
        where: { id: sale.id },
        data: { loyaltyPointsEarned: 0 },
      });
    });

    if (clawed < points) {
      this.logger.warn(
        `POS sale ${sale.id} void clawed only ${clawed}/${points} points for membership ${membership.id} — balance was already spent`,
      );
    }
    await this.tiers.recalculateTier(membership.id);
  }
}
