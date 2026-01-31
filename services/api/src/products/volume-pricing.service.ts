import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateVolumePricingDto } from './dto/create-volume-pricing.dto';
import { Decimal } from '@prisma/client/runtime/library';

export interface VolumePricingTier {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  price: number | null;
  priority: number;
}

@Injectable()
export class VolumePricingService {
  private readonly logger = new Logger(VolumePricingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create volume pricing tier for a product
   */
  async createVolumePricing(createDto: CreateVolumePricingDto) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: createDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate quantity range doesn't overlap with existing tiers
    const existingTiers = await this.prisma.volumePricing.findMany({
      where: {
        productId: createDto.productId,
        isActive: true,
      },
    });

    // Check for overlaps
    for (const tier of existingTiers) {
      const existingMin = tier.minQuantity;
      const existingMax = tier.maxQuantity || Infinity;
      const newMin = createDto.minQuantity;
      const newMax = createDto.maxQuantity || Infinity;

      if (
        (newMin >= existingMin && newMin <= existingMax) ||
        (newMax >= existingMin && newMax <= existingMax) ||
        (newMin <= existingMin && newMax >= existingMax)
      ) {
        throw new BadRequestException(
          `Quantity range overlaps with existing tier (${existingMin}-${existingMax || '∞'})`,
        );
      }
    }

    // Validate discount values
    if (createDto.discountType === 'PERCENTAGE' && createDto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    if (createDto.discountType === 'FIXED' && createDto.discountValue > Number(product.price)) {
      throw new BadRequestException('Fixed discount cannot exceed product price');
    }

    return this.prisma.volumePricing.create({
      data: {
        productId: createDto.productId,
        minQuantity: createDto.minQuantity,
        maxQuantity: createDto.maxQuantity || null,
        discountType: createDto.discountType,
        discountValue: new Decimal(createDto.discountValue),
        price: createDto.price ? new Decimal(createDto.price) : null,
        priority: createDto.priority || 0,
        isActive: createDto.isActive ?? true,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });
  }

  /**
   * Get volume pricing tiers for a product
   */
  async getVolumePricingByProduct(productId: string) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    return this.prisma.volumePricing.findMany({
      where: {
        productId,
        isActive: true,
      },
      orderBy: [{ priority: 'desc' }, { minQuantity: 'asc' }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });
  }

  /**
   * Calculate price with volume pricing
   */
  async calculatePrice(
    productId: string,
    quantity: number,
  ): Promise<{
    originalPrice: number;
    finalPrice: number;
    discount: number;
    discountType: string;
    tier: VolumePricingTier | null;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, price: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const originalPrice = Number(product.price);
    const itemTotal = originalPrice * quantity;

    // Find matching tier
    const tiers = await this.prisma.volumePricing.findMany({
      where: {
        productId,
        isActive: true,
        minQuantity: { lte: quantity },
        OR: [{ maxQuantity: null }, { maxQuantity: { gte: quantity } }],
      },
      orderBy: [
        { priority: 'desc' },
        { minQuantity: 'desc' }, // Higher quantity tiers first
      ],
      take: 1,
    });

    if (tiers.length === 0) {
      return {
        originalPrice: itemTotal,
        finalPrice: itemTotal,
        discount: 0,
        discountType: 'NONE',
        tier: null,
      };
    }

    const tier = tiers[0];
    let finalPrice: number;
    let discount: number = 0;

    // If tier has fixed price, use it
    if (tier.price) {
      finalPrice = Number(tier.price) * quantity;
      discount = itemTotal - finalPrice;
    } else {
      // Calculate discount
      if (tier.discountType === 'PERCENTAGE') {
        const discountPercent = Number(tier.discountValue) / 100;
        discount = itemTotal * discountPercent;
        finalPrice = itemTotal - discount;
      } else {
        // FIXED discount per item
        discount = Number(tier.discountValue) * quantity;
        finalPrice = itemTotal - discount;
      }
    }

    return {
      originalPrice: itemTotal,
      finalPrice: Math.max(0, finalPrice),
      discount: Math.max(0, discount),
      discountType: tier.discountType,
      tier: {
        id: tier.id,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        discountType: tier.discountType as 'PERCENTAGE' | 'FIXED',
        discountValue: Number(tier.discountValue),
        price: tier.price ? Number(tier.price) : null,
        priority: tier.priority,
      },
    };
  }

  /**
   * Update volume pricing tier
   */
  async updateVolumePricing(id: string, updateDto: Partial<CreateVolumePricingDto>) {
    const tier = await this.prisma.volumePricing.findUnique({
      where: { id },
    });

    if (!tier) {
      throw new NotFoundException('Volume pricing tier not found');
    }

    const updateData: any = {};
    if (updateDto.minQuantity !== undefined) updateData.minQuantity = updateDto.minQuantity;
    if (updateDto.maxQuantity !== undefined) updateData.maxQuantity = updateDto.maxQuantity || null;
    if (updateDto.discountType !== undefined) updateData.discountType = updateDto.discountType;
    if (updateDto.discountValue !== undefined)
      updateData.discountValue = new Decimal(updateDto.discountValue);
    if (updateDto.price !== undefined)
      updateData.price = updateDto.price ? new Decimal(updateDto.price) : null;
    if (updateDto.priority !== undefined) updateData.priority = updateDto.priority;
    if (updateDto.isActive !== undefined) updateData.isActive = updateDto.isActive;

    return this.prisma.volumePricing.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });
  }

  /**
   * Delete volume pricing tier
   */
  async deleteVolumePricing(id: string) {
    await this.prisma.volumePricing.findUniqueOrThrow({
      where: { id },
    });

    return this.prisma.volumePricing.delete({
      where: { id },
    });
  }
}
