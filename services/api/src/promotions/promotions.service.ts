import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { PromotionType, PromotionStatus } from '@prisma/client';
import {
  PromotionWithDetails,
  PromotionActions,
  PromotionConditions,
  CartItemForPromotion,
  AppliedPromotion,
  PromotionApplicationResult,
} from './types/promotion.types';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private prisma: PrismaService, private cache: CacheService) {}

  /**
   * Create a new promotion
   */
  async create(createDto: CreatePromotionDto) {
    // Validate dates
    const startDate = new Date(createDto.startDate);
    const endDate = createDto.endDate ? new Date(createDto.endDate) : null;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const promo = await this.prisma.promotion.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        type: createDto.type,
        status: createDto.status || PromotionStatus.DRAFT,
        priority: createDto.priority || 0,
        startDate,
        endDate,
        conditions: createDto.conditions as any,
        actions: createDto.actions as any,
        isStackable: createDto.isStackable || false,
        usageLimit: createDto.usageLimit,
        userUsageLimit: createDto.userUsageLimit,
        sellerId: createDto.sellerId,
      },
    });
    await this.invalidatePromoCache();
    return promo;
  }

  /**
   * Get promotions. When activeOnly is true (default), only returns currently
   * active promotions that have started and not expired. When false, returns all.
   */
  async findAll(sellerId?: string, activeOnly = true) {
    const now = new Date();
    const where: any = activeOnly
      ? {
          status: PromotionStatus.ACTIVE,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          ...(sellerId ? { sellerId } : { sellerId: null }), // Platform-wide or seller-specific
        }
      : {
          ...(sellerId ? { sellerId } : {}),
        };
    return this.prisma.promotion.findMany({
      where,
      orderBy: { priority: 'desc' },
      include: {
        coupons: {
          where: {
            status: 'ACTIVE',
          },
        },
      },
    });
  }

  private static readonly PROMO_CACHE_KEY = 'promos:active';
  private static readonly PROMO_CACHE_TTL = 30;

  private async invalidatePromoCache() {
    await this.cache.del(PromotionsService.PROMO_CACHE_KEY).catch(() => {});
  }

  private async findAllCached() {
    const cached = await this.cache.get<any[]>(PromotionsService.PROMO_CACHE_KEY);
    if (cached) return cached;
    const data = await this.findAll();
    await this.cache.set(PromotionsService.PROMO_CACHE_KEY, data, PromotionsService.PROMO_CACHE_TTL);
    return data;
  }

  /**
   * Get promotion by ID
   */
  async findOne(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        coupons: true,
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  /**
   * Update promotion
   */
  async update(id: string, updateDto: Partial<CreatePromotionDto>) {
    const promotion = await this.findOne(id);

    const updateData: any = {
      name: updateDto.name,
      description: updateDto.description,
      type: updateDto.type,
      status: updateDto.status,
      priority: updateDto.priority,
      isStackable: updateDto.isStackable,
      usageLimit: updateDto.usageLimit,
      userUsageLimit: updateDto.userUsageLimit,
      sellerId: updateDto.sellerId,
    };
    if (updateDto.startDate) {
      updateData.startDate = new Date(updateDto.startDate);
    }
    if (updateDto.endDate !== undefined) {
      updateData.endDate = updateDto.endDate ? new Date(updateDto.endDate) : null;
    }
    if (updateDto.conditions) {
      updateData.conditions = updateDto.conditions as any;
    }
    if (updateDto.actions) {
      updateData.actions = updateDto.actions as any;
    }
    // Remove undefined keys so Prisma doesn't try to set them
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const result = await this.prisma.promotion.update({
      where: { id },
      data: updateData,
    });
    await this.invalidatePromoCache();
    return result;
  }

  /**
   * Delete a promotion
   */
  async delete(id: string) {
    await this.findOne(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        const coupons = await tx.coupon.findMany({
          where: { promotionId: id },
          select: { id: true },
        });
        const couponIds = coupons.map((c) => c.id);

        if (couponIds.length > 0) {
          await tx.couponUsage.deleteMany({ where: { couponId: { in: couponIds } } });
          // Carts referencing these coupons are auto-nulled via the
          // Cart.coupon relation (onDelete: SetNull on couponCode).
          await tx.coupon.deleteMany({ where: { promotionId: id } });
        }

        await tx.promotionUsage.deleteMany({ where: { promotionId: id } });
        await tx.promotion.delete({ where: { id } });
      });
    } catch (err: any) {
      throw new BadRequestException(
        err?.message?.includes('Foreign key')
          ? 'Cannot delete promotion: it is still referenced by orders or carts. Deactivate it instead.'
          : `Failed to delete promotion: ${err?.message || 'unknown error'}`,
      );
    }

    await this.invalidatePromoCache();
    return { message: 'Promotion deleted successfully' };
  }

  /**
   * Create a coupon for a promotion
   */
  async createCoupon(createDto: CreateCouponDto) {
    const promotion = await this.findOne(createDto.promotionId);

    // Check if coupon code already exists
    const existing = await this.prisma.coupon.findUnique({
      where: { code: createDto.code.toUpperCase() },
    });

    if (existing) {
      throw new BadRequestException('Coupon code already exists');
    }

    return this.prisma.coupon.create({
      data: {
        code: createDto.code.toUpperCase(),
        promotionId: createDto.promotionId,
        usageLimit: createDto.usageLimit,
        userLimit: createDto.userLimit || 1,
        expiresAt: createDto.expiresAt ? new Date(createDto.expiresAt) : null,
      },
    });
  }

  /**
   * Validate and apply coupon to cart
   * @param cartItems Optional line items for product/category/min-qty and targeted discount validation
   */
  async validateCoupon(
    code: string,
    userId: string,
    cartValue: number,
    cartItems: CartItemForPromotion[] = [],
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        promotion: true,
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Check status
    if (coupon.status !== 'ACTIVE') {
      throw new BadRequestException('Coupon is not active');
    }

    // Check expiration
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    // Check user limit
    const userUsageCount = await this.prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        userId,
      },
    });

    if (coupon.userLimit && userUsageCount >= coupon.userLimit) {
      throw new BadRequestException('You have already used this coupon');
    }

    // Check promotion validity
    const promotion = coupon.promotion;
    const now = new Date();
    if (promotion.status !== PromotionStatus.ACTIVE) {
      throw new BadRequestException('Promotion is not active');
    }

    if (promotion.startDate > now) {
      throw new BadRequestException('Promotion has not started yet');
    }

    if (promotion.endDate && promotion.endDate < now) {
      throw new BadRequestException('Promotion has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { customerGroupId: true },
    });

    if (
      !this.promotionConditionsMet(
        promotion as PromotionWithDetails,
        cartItems,
        cartValue,
        user?.customerGroupId ?? null,
      )
    ) {
      throw new BadRequestException('Promotion conditions are not met for this cart');
    }

    return {
      coupon,
      promotion,
      discount: this.calculateDiscount(
        promotion as PromotionWithDetails,
        cartValue,
        cartItems,
      ),
    };
  }

  /**
   * Calculate discount amount based on promotion (shipping promos return 0 discount here).
   */
  private calculateDiscount(
    promotion: PromotionWithDetails,
    cartValue: number,
    cartItems: CartItemForPromotion[],
  ): Decimal {
    const actions = promotion.actions as PromotionActions;
    const conditions = promotion.conditions as PromotionConditions;

    switch (promotion.type) {
      case PromotionType.PERCENTAGE_DISCOUNT: {
        const percentage = actions.percentage || 0;
        return new Decimal(cartValue).mul(percentage).div(100);
      }

      case PromotionType.FIXED_DISCOUNT: {
        const fixedAmount = actions.fixedAmount || 0;
        return new Decimal(Math.min(fixedAmount, cartValue));
      }

      case PromotionType.CART_DISCOUNT: {
        if (actions.percentage != null && actions.percentage > 0) {
          return new Decimal(cartValue).mul(actions.percentage).div(100);
        }
        const fixedAmt = actions.fixedAmount || 0;
        return new Decimal(Math.min(fixedAmt, cartValue));
      }

      case PromotionType.PRODUCT_DISCOUNT: {
        const productIds = conditions.productIds;
        if (!productIds?.length) {
          return new Decimal(0);
        }
        const eligibleSubtotal = cartItems
          .filter((i) => productIds.includes(i.productId))
          .reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
        if (eligibleSubtotal <= 0) return new Decimal(0);
        if (actions.percentage != null && actions.percentage > 0) {
          return new Decimal(eligibleSubtotal).mul(actions.percentage).div(100);
        }
        const fixedAmt = actions.fixedAmount || 0;
        return new Decimal(Math.min(fixedAmt, eligibleSubtotal));
      }

      case PromotionType.BUY_X_GET_Y: {
        const x = actions.buyQuantity ?? 0;
        const y = actions.getQuantity ?? 0;
        if (x <= 0 || y <= 0) return new Decimal(0);

        let units: CartItemForPromotion[] = cartItems;
        if (conditions.productIds?.length) {
          const set = new Set(conditions.productIds);
          units = cartItems.filter((i) => set.has(i.productId));
        }

        const unitPrices: number[] = [];
        for (const item of units) {
          const p = Number(item.price);
          for (let q = 0; q < item.quantity; q++) {
            unitPrices.push(p);
          }
        }
        if (unitPrices.length < x + y) return new Decimal(0);

        unitPrices.sort((a, b) => a - b);
        const bundle = x + y;
        const bundles = Math.floor(unitPrices.length / bundle);
        const freeSlots = bundles * y;
        if (freeSlots <= 0) return new Decimal(0);

        let discount = 0;
        for (let i = 0; i < freeSlots; i++) {
          discount += unitPrices[i];
        }
        return new Decimal(discount);
      }

      case PromotionType.FREE_SHIPPING:
        return new Decimal(0);

      default:
        return new Decimal(0);
    }
  }

  private promotionConditionsMet(
    promotion: PromotionWithDetails,
    cartItems: CartItemForPromotion[],
    cartSubtotal: number,
    userCustomerGroupId: string | null,
  ): boolean {
    const conditions = promotion.conditions as PromotionConditions;

    if (conditions.cartValue) {
      if (conditions.cartValue.min && cartSubtotal < conditions.cartValue.min) {
        return false;
      }
      if (conditions.cartValue.max && cartSubtotal > conditions.cartValue.max) {
        return false;
      }
    }

    if (conditions.customerGroupId) {
      if (userCustomerGroupId !== conditions.customerGroupId) {
        return false;
      }
    }

    if (conditions.productIds && conditions.productIds.length > 0) {
      const cartProductIds = cartItems.map((item) => item.productId);
      const hasRequiredProduct = conditions.productIds.some((id: string) =>
        cartProductIds.includes(id),
      );
      if (!hasRequiredProduct) {
        return false;
      }
    }

    if (conditions.categoryIds && conditions.categoryIds.length > 0) {
      const hasCategory = cartItems.some(
        (item) => item.categoryId && conditions.categoryIds!.includes(item.categoryId),
      );
      if (!hasCategory) {
        return false;
      }
    }

    if (conditions.minQuantity) {
      const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity < conditions.minQuantity) {
        return false;
      }
    }

    return true;
  }

  private canApplyAutomaticPromotion(
    promotion: PromotionWithDetails,
    couponPromotionId: string | null,
    couponBlocksAutomatic: boolean,
    applied: AppliedPromotion[],
  ): boolean {
    if (couponBlocksAutomatic) {
      return false;
    }
    if (couponPromotionId && promotion.id === couponPromotionId) {
      return false;
    }

    const hasExclusiveApplied = applied.some((p) => p.isStackable === false);

    // Non-stackable: allowed when nothing is applied yet, or when only stackable promos/coupons
    // are applied (cannot stack with another exclusive / non-stackable).
    if (!promotion.isStackable) {
      if (applied.length === 0) {
        return true;
      }
      return !hasExclusiveApplied;
    }

    if (hasExclusiveApplied) {
      return false;
    }
    return true;
  }

  private buildAppliedPromotionEntry(
    promotion: PromotionWithDetails,
    kind: 'coupon' | 'promotion',
    couponCode: string | undefined,
    discount: Decimal,
  ): AppliedPromotion {
    const grantsFs = promotion.type === PromotionType.FREE_SHIPPING;
    return {
      type: kind,
      id: promotion.id,
      code: couponCode,
      name: promotion.name,
      discount: Number(discount),
      isStackable: promotion.isStackable,
      promotionType: promotion.type,
      grantsFreeShipping: grantsFs,
    };
  }

  /**
   * Apply promotions to cart
   */
  async applyPromotionsToCart(
    _cartId: string,
    userId: string,
    cartItems: CartItemForPromotion[],
    couponCode?: string,
  ): Promise<PromotionApplicationResult> {
    const cartSubtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );

    let totalDiscount = new Decimal(0);
    const appliedPromotions: AppliedPromotion[] = [];
    let couponPromotionId: string | null = null;
    let couponBlocksAutomatic = false;

    if (couponCode) {
      try {
        const couponResult = await this.validateCoupon(couponCode, userId, cartSubtotal, cartItems);
        const promotion = couponResult.promotion as PromotionWithDetails;
        couponPromotionId = promotion.id;
        couponBlocksAutomatic = !promotion.isStackable;

        const discount = this.calculateDiscount(promotion, cartSubtotal, cartItems);
        const grantsFs = promotion.type === PromotionType.FREE_SHIPPING;
        if (!grantsFs) {
          totalDiscount = totalDiscount.add(discount);
        }
        appliedPromotions.push(
          this.buildAppliedPromotionEntry(promotion, 'coupon', couponCode, discount),
        );
      } catch (error: any) {
        this.logger.warn(`Failed to apply coupon ${couponCode}: ${error.message}`);
      }
    }

    const userForPromotions = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { customerGroupId: true },
    });
    const customerGroupId = userForPromotions?.customerGroupId ?? null;

    const promotions = await this.findAllCached();
    // Batch-fetch per-user usage counts for all promotions that have a userUsageLimit
    const promosWithUserLimit = promotions.filter((p: any) => p.userUsageLimit != null);
    const userUsageMap = new Map<string, number>();
    if (promosWithUserLimit.length > 0) {
      const usageCounts = await this.prisma.promotionUsage.groupBy({
        by: ['promotionId'],
        where: {
          userId,
          promotionId: { in: promosWithUserLimit.map((p: any) => p.id) },
        },
        _count: { promotionId: true },
      });
      for (const row of usageCounts) {
        userUsageMap.set(row.promotionId, row._count.promotionId);
      }
    }

    for (const promotion of promotions) {
      const promo = promotion as PromotionWithDetails;

      if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit) {
        continue;
      }

      if (promo.userUsageLimit != null) {
        const userUses = userUsageMap.get(promo.id) ?? 0;
        if (userUses >= promo.userUsageLimit) {
          continue;
        }
      }

      if (
        !this.canApplyAutomaticPromotion(
          promo,
          couponPromotionId,
          couponBlocksAutomatic,
          appliedPromotions,
        )
      ) {
        continue;
      }

      if (!this.promotionConditionsMet(promo, cartItems, cartSubtotal, customerGroupId)) {
        continue;
      }

      const discount = this.calculateDiscount(promo, cartSubtotal, cartItems);
      const grantsFs = promo.type === PromotionType.FREE_SHIPPING;
      if (!grantsFs && !discount.gt(0)) {
        continue;
      }
      if (!grantsFs) {
        totalDiscount = totalDiscount.add(discount);
      }
      appliedPromotions.push(this.buildAppliedPromotionEntry(promo, 'promotion', undefined, discount));
    }

    if (totalDiscount.gt(cartSubtotal)) {
      totalDiscount = new Decimal(cartSubtotal);
    }

    const freeShipping = appliedPromotions.some((p) => p.grantsFreeShipping);

    return {
      discount: Number(totalDiscount),
      appliedPromotions,
      freeShipping,
    };
  }

  /**
   * Record coupon usage
   */
  async recordCouponUsage(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: number,
  ) {
    // Atomic conditional increment: only bump if under limit (prevents concurrent overshooting)
    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      const bumped = await tx.coupon.updateMany({
        where: {
          id: couponId,
          OR: [
            { usageLimit: null },
            { usageCount: { lt: coupon.usageLimit ?? 999999999 } },
          ],
        },
        data: { usageCount: { increment: 1 } },
      });
      if (bumped.count === 0) {
        this.logger.warn(`Coupon ${couponId} usage limit reached; skipping`);
        return null;
      }

      // Check if coupon is now exhausted
      if (coupon.usageLimit && coupon.usageCount + 1 >= coupon.usageLimit) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { status: 'EXHAUSTED' },
        });
      }

      return tx.couponUsage.create({
        data: {
          couponId,
          userId,
          orderId,
          discountAmount: new Decimal(discountAmount),
        },
      });
    });
  }

  /**
   * After a successful checkout, persist coupon + automatic promotion usage counts.
   * Skipped for idempotent duplicate responses (caller must not invoke when order was not newly created).
   */
  async recordUsagesAfterOrder(
    userId: string,
    orderId: string,
    snapshot: PromotionApplicationResult,
  ): Promise<void> {
    for (const ap of snapshot.appliedPromotions) {
      if (ap.type === 'coupon' && ap.code) {
        try {
          const coupon = await this.prisma.coupon.findUnique({ where: { code: ap.code } });
          if (coupon) {
            await this.recordCouponUsage(coupon.id, userId, orderId, ap.discount);
          }
        } catch (e: any) {
          this.logger.warn(
            `Coupon usage record failed for order ${orderId} code ${ap.code}: ${e?.message ?? e}`,
          );
        }
      } else if (ap.type === 'promotion' && ap.id) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const promo = await tx.promotion.findUnique({ where: { id: ap.id! } });
            if (!promo) return;
            if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit) {
              this.logger.warn(
                `Promotion ${ap.id} global usage limit reached; skipping for order ${orderId}`,
              );
              return;
            }
            if (promo.userUsageLimit != null) {
              const n = await tx.promotionUsage.count({
                where: { userId, promotionId: ap.id! },
              });
              if (n >= promo.userUsageLimit) return;
            }
            // Conditional increment: only if still under limit
            const bumped = await tx.promotion.updateMany({
              where: {
                id: ap.id!,
                OR: [
                  { usageLimit: null },
                  { usageCount: { lt: promo.usageLimit ?? 999999999 } },
                ],
              },
              data: { usageCount: { increment: 1 } },
            });
            if (bumped.count === 0) return;
            await tx.promotionUsage.create({
              data: { promotionId: ap.id!, userId, orderId },
            });
          });
        } catch (e: any) {
          this.logger.warn(
            `Promotion usage record failed for order ${orderId} promotion ${ap.id}: ${e?.message ?? e}`,
          );
        }
      }
    }
  }

  /**
   * Apply coupon to cart
   */
  async applyCouponToCart(cartId: string, userId: string, couponCode: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cart.userId !== userId) {
      throw new ForbiddenException("Cannot modify another user's cart");
    }

    const cartSubtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );

    const cartItems: CartItemForPromotion[] = cart.items.map((item) => ({
      productId: item.productId,
      price: Number(item.price),
      quantity: item.quantity,
      categoryId: item.product.categoryId,
    }));

    const result = await this.validateCoupon(couponCode, userId, cartSubtotal, cartItems);

    // Update cart with coupon
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        couponCode: couponCode.toUpperCase(),
      },
    });

    return result;
  }

  /**
   * Remove coupon from cart
   */
  async removeCouponFromCart(cartId: string, userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cart.userId !== userId) {
      throw new ForbiddenException("Cannot modify another user's cart");
    }

    return this.prisma.cart.update({
      where: { id: cartId },
      data: {
        couponCode: null,
      },
    });
  }
}
