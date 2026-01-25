import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
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

  constructor(private prisma: PrismaService) {}

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

    return this.prisma.promotion.create({
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
        sellerId: createDto.sellerId,
      },
    });
  }

  /**
   * Get all active promotions
   */
  async findAll(sellerId?: string) {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        status: PromotionStatus.ACTIVE,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
        ...(sellerId ? { sellerId } : { sellerId: null }), // Platform-wide or seller-specific
      },
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

    const updateData: any = { ...updateDto };
    if (updateDto.startDate) {
      updateData.startDate = new Date(updateDto.startDate);
    }
    if (updateDto.endDate) {
      updateData.endDate = new Date(updateDto.endDate);
    }
    if (updateDto.conditions) {
      updateData.conditions = updateDto.conditions as any;
    }
    if (updateDto.actions) {
      updateData.actions = updateDto.actions as any;
    }

    return this.prisma.promotion.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a promotion
   */
  async delete(id: string) {
    // First verify the promotion exists
    await this.findOne(id);

    // Delete associated coupons first
    await this.prisma.coupon.deleteMany({
      where: { promotionId: id },
    });

    // Delete the promotion
    return this.prisma.promotion.delete({
      where: { id },
    });
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
   */
  async validateCoupon(code: string, userId: string, cartValue: number) {
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

    // Check conditions
    const conditions = promotion.conditions as PromotionConditions;
    if (conditions.cartValue) {
      if (conditions.cartValue.min && cartValue < conditions.cartValue.min) {
        throw new BadRequestException(
          `Minimum cart value of ${conditions.cartValue.min} required`,
        );
      }
      if (conditions.cartValue.max && cartValue > conditions.cartValue.max) {
        throw new BadRequestException(
          `Maximum cart value of ${conditions.cartValue.max} exceeded`,
        );
      }
    }

    return {
      coupon,
      promotion,
      discount: this.calculateDiscount(promotion as PromotionWithDetails, cartValue),
    };
  }

  /**
   * Calculate discount amount based on promotion
   */
  private calculateDiscount(promotion: PromotionWithDetails, cartValue: number): Decimal {
    const actions = promotion.actions as PromotionActions;

    switch (promotion.type) {
      case PromotionType.PERCENTAGE_DISCOUNT:
        const percentage = actions.percentage || 0;
        return new Decimal(cartValue).mul(percentage).div(100);

      case PromotionType.FIXED_DISCOUNT:
        const fixedAmount = actions.fixedAmount || 0;
        return new Decimal(Math.min(fixedAmount, cartValue));

      case PromotionType.FREE_SHIPPING:
        // Free shipping is handled separately
        return new Decimal(0);

      default:
        return new Decimal(0);
    }
  }

  /**
   * Apply promotions to cart
   */
  async applyPromotionsToCart(
    cartId: string,
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

    // Apply coupon if provided
    if (couponCode) {
      try {
        const couponResult = await this.validateCoupon(
          couponCode,
          userId,
          cartSubtotal,
        );
        const discount = this.calculateDiscount(
          couponResult.promotion as PromotionWithDetails,
          cartSubtotal,
        );
        totalDiscount = totalDiscount.add(discount);
        appliedPromotions.push({
          type: 'coupon',
          code: couponCode,
          discount: Number(discount),
        });
      } catch (error) {
        this.logger.warn(`Failed to apply coupon ${couponCode}: ${error.message}`);
      }
    }

    // Apply automatic promotions
    const promotions = await this.findAll();
    for (const promotion of promotions) {
      // Skip if already applied via coupon
      if (couponCode && appliedPromotions.some((p) => p.code === couponCode)) {
        continue;
      }

      // Check if promotion applies
      if (this.promotionApplies(promotion as PromotionWithDetails, cartItems, cartSubtotal, userId)) {
        const discount = this.calculateDiscount(promotion as PromotionWithDetails, cartSubtotal);
        if (discount.gt(0)) {
          totalDiscount = totalDiscount.add(discount);
          appliedPromotions.push({
            type: 'promotion',
            id: promotion.id,
            name: promotion.name,
            discount: Number(discount),
          });
        }
      }
    }

    return {
      discount: Number(totalDiscount),
      appliedPromotions,
    };
  }

  /**
   * Check if promotion applies to cart
   */
  private promotionApplies(
    promotion: PromotionWithDetails,
    cartItems: CartItemForPromotion[],
    cartSubtotal: number,
    userId: string,
  ): boolean {
    const conditions = promotion.conditions as PromotionConditions;

    // Check cart value
    if (conditions.cartValue) {
      if (conditions.cartValue.min && cartSubtotal < conditions.cartValue.min) {
        return false;
      }
      if (conditions.cartValue.max && cartSubtotal > conditions.cartValue.max) {
        return false;
      }
    }

    // Check product IDs
    if (conditions.productIds && conditions.productIds.length > 0) {
      const cartProductIds = cartItems.map((item) => item.productId);
      const hasRequiredProduct = conditions.productIds.some((id: string) =>
        cartProductIds.includes(id),
      );
      if (!hasRequiredProduct) {
        return false;
      }
    }

    // Check minimum quantity
    if (conditions.minQuantity) {
      const totalQuantity = cartItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      if (totalQuantity < conditions.minQuantity) {
        return false;
      }
    }

    return true;
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
    // Get current coupon to check limits
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Check if coupon will be exhausted
    const newUsageCount = coupon.usageCount + 1;
    const newStatus =
      coupon.usageLimit && newUsageCount >= coupon.usageLimit
        ? 'EXHAUSTED'
        : coupon.status;

    // Update coupon usage count and status
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        usageCount: { increment: 1 },
        status: newStatus,
      },
    });

    // Record usage
    return this.prisma.couponUsage.create({
      data: {
        couponId,
        userId,
        orderId,
        discountAmount: new Decimal(discountAmount),
      },
    });
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
      throw new ForbiddenException('Cannot modify another user\'s cart');
    }

    const cartSubtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );

    const result = await this.validateCoupon(couponCode, userId, cartSubtotal);

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
      throw new ForbiddenException('Cannot modify another user\'s cart');
    }

    return this.prisma.cart.update({
      where: { id: cartId },
      data: {
        couponCode: null,
      },
    });
  }
}
