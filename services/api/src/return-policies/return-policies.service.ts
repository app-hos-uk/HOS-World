import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReturnPolicyDto } from './dto/create-return-policy.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReturnPoliciesService {
  private readonly logger = new Logger(ReturnPoliciesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new return policy
   */
  async create(createDto: CreateReturnPolicyDto) {
    // Validate that only one of productId, categoryId, or sellerId is set (or none for platform-wide)
    const scopeCount = [createDto.productId, createDto.categoryId, createDto.sellerId].filter(
      Boolean,
    ).length;

    if (scopeCount > 1) {
      throw new BadRequestException(
        'Return policy can only be scoped to one of: product, category, or seller',
      );
    }

    return this.prisma.returnPolicy.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        sellerId: createDto.sellerId,
        productId: createDto.productId,
        categoryId: createDto.categoryId,
        isReturnable: createDto.isReturnable ?? true,
        returnWindowDays: createDto.returnWindowDays,
        requiresApproval: createDto.requiresApproval ?? false,
        requiresInspection: createDto.requiresInspection ?? false,
        refundMethod: createDto.refundMethod,
        restockingFee: createDto.restockingFee ? new Decimal(createDto.restockingFee) : null,
        priority: createDto.priority || 0,
        isActive: createDto.isActive ?? true,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all return policies
   */
  async findAll(sellerId?: string, productId?: string, categoryId?: string) {
    const where: any = { isActive: true };

    if (sellerId) {
      where.OR = [
        { sellerId },
        { sellerId: null }, // Platform-wide policies
      ];
    }

    if (productId) {
      where.OR = [
        { productId },
        { productId: null, categoryId },
        { productId: null, categoryId: null, sellerId },
        { productId: null, categoryId: null, sellerId: null }, // Platform-wide
      ];
    }

    if (categoryId) {
      where.OR = [
        { categoryId },
        { categoryId: null, sellerId },
        { categoryId: null, sellerId: null }, // Platform-wide
      ];
    }

    return this.prisma.returnPolicy.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get return policy by ID
   */
  async findOne(id: string) {
    const policy = await this.prisma.returnPolicy.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        returnRequests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException('Return policy not found');
    }

    return policy;
  }

  /**
   * Get applicable return policy for a product/order
   */
  async getApplicablePolicy(productId: string, sellerId?: string, categoryId?: string) {
    // Find policies in priority order:
    // 1. Product-specific
    // 2. Category-specific
    // 3. Seller-specific
    // 4. Platform-wide

    const policies = await this.prisma.returnPolicy.findMany({
      where: {
        isActive: true,
        OR: [
          { productId },
          { categoryId },
          { sellerId },
          { sellerId: null, productId: null, categoryId: null }, // Platform-wide
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Return the first matching policy (highest priority)
    return policies[0] || null;
  }

  /**
   * Check if return is allowed for an order
   */
  async checkReturnEligibility(
    orderId: string,
    productId?: string,
  ): Promise<{
    eligible: boolean;
    policy?: any;
    reason?: string;
    returnWindowDays?: number;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                categoryRelation: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order is within return window
    const deliveryDate = order.createdAt; // Use createdAt as delivery date
    const daysSinceDelivery = Math.floor(
      (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Get applicable policy
    const product = productId
      ? order.items.find((item) => item.productId === productId)?.product
      : order.items[0]?.product;

    if (!product) {
      return {
        eligible: false,
        reason: 'Product not found in order',
      };
    }

    const policy = await this.getApplicablePolicy(
      product.id,
      product.sellerId || undefined,
      product.categoryRelation?.id || undefined,
    );

    if (!policy) {
      return {
        eligible: false,
        reason: 'No return policy found',
      };
    }

    if (!policy.isReturnable) {
      return {
        eligible: false,
        policy,
        reason: 'Product is not returnable',
      };
    }

    if (daysSinceDelivery > policy.returnWindowDays) {
      return {
        eligible: false,
        policy,
        reason: `Return window expired. Return must be initiated within ${policy.returnWindowDays} days of delivery.`,
        returnWindowDays: policy.returnWindowDays,
      };
    }

    return {
      eligible: true,
      policy,
      returnWindowDays: policy.returnWindowDays,
    };
  }

  /**
   * Update return policy
   */
  async update(id: string, updateDto: Partial<CreateReturnPolicyDto>) {
    await this.findOne(id);

    const updateData: any = { ...updateDto };
    if (updateDto.restockingFee !== undefined) {
      updateData.restockingFee = updateDto.restockingFee
        ? new Decimal(updateDto.restockingFee)
        : null;
    }

    return this.prisma.returnPolicy.update({
      where: { id },
      data: updateData,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Delete return policy
   */
  async delete(id: string) {
    await this.findOne(id);

    return this.prisma.returnPolicy.delete({
      where: { id },
    });
  }
}
