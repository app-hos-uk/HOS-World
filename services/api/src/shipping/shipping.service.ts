import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import { CreateShippingRuleDto } from './dto/create-shipping-rule.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { ShippingMethodType } from '@prisma/client';
import {
  ShippingMethodWithRules,
  ShippingRuleWithDetails,
  ShippingRuleConditions,
  ShippingDestination,
  ShippingOption,
  CartItemForShipping,
} from './types/shipping.types';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new shipping method
   */
  async createShippingMethod(createDto: CreateShippingMethodDto) {
    return this.prisma.shippingMethod.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        type: createDto.type,
        isActive: createDto.isActive ?? true,
        sellerId: createDto.sellerId,
      },
      include: {
        rules: true,
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
    });
  }

  /**
   * Get all shipping methods
   */
  async findAllShippingMethods(sellerId?: string): Promise<ShippingMethodWithRules[]> {
    const methods = await this.prisma.shippingMethod.findMany({
      where: {
        isActive: true,
        ...(sellerId ? { sellerId } : { sellerId: null }), // Platform-wide or seller-specific
      },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Convert Prisma Decimal types to numbers for ShippingRuleWithDetails
    return methods.map((method) => ({
      ...method,
      rules: (method.rules || []).map((rule: any) => ({
        ...rule,
        rate: Number(rule.rate),
        freeShippingThreshold: rule.freeShippingThreshold ? Number(rule.freeShippingThreshold) : null,
        conditions: rule.conditions as ShippingRuleConditions,
      })) as ShippingRuleWithDetails[],
    })) as ShippingMethodWithRules[];
  }

  /**
   * Get shipping method by ID
   */
  async findShippingMethodById(id: string): Promise<ShippingMethodWithRules> {
    const method = await this.prisma.shippingMethod.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: { priority: 'desc' },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
    });

    if (!method) {
      throw new NotFoundException('Shipping method not found');
    }

    // Convert Prisma Decimal types to numbers for ShippingRuleWithDetails
    return {
      ...method,
      rules: (method.rules || []).map((rule: any) => ({
        ...rule,
        rate: Number(rule.rate),
        freeShippingThreshold: rule.freeShippingThreshold ? Number(rule.freeShippingThreshold) : null,
        conditions: rule.conditions as ShippingRuleConditions,
      })) as ShippingRuleWithDetails[],
    } as ShippingMethodWithRules;
  }

  /**
   * Create a shipping rule
   */
  async createShippingRule(createDto: CreateShippingRuleDto) {
    // Verify shipping method exists
    await this.findShippingMethodById(createDto.shippingMethodId);

    return this.prisma.shippingRule.create({
      data: {
        shippingMethodId: createDto.shippingMethodId,
        name: createDto.name,
        priority: createDto.priority || 0,
        conditions: (createDto.conditions || {}) as any,
        rate: new Decimal(createDto.rate),
        freeShippingThreshold: createDto.freeShippingThreshold
          ? new Decimal(createDto.freeShippingThreshold)
          : null,
        estimatedDays: createDto.estimatedDays,
        isActive: createDto.isActive ?? true,
      },
      include: {
        shippingMethod: true,
      },
    });
  }

  /**
   * Calculate shipping rate for a cart/order
   */
  async calculateShippingRate(
    weight: number, // in kg
    cartValue: number,
    destination: ShippingDestination,
    sellerId?: string,
  ): Promise<ShippingOption[]> {
    // Get applicable shipping methods
    const methods = await this.findAllShippingMethods(sellerId);

    const availableOptions: ShippingOption[] = [];

    for (const method of methods) {
      // Convert Prisma rules to ShippingRuleWithDetails format
      // Prisma returns Decimal types, but our interface expects numbers
      const rulesWithDetails: ShippingRuleWithDetails[] = (method.rules || []).map((rule: any) => ({
        ...rule,
        rate: Number(rule.rate),
        freeShippingThreshold: rule.freeShippingThreshold ? Number(rule.freeShippingThreshold) : null,
        conditions: rule.conditions as ShippingRuleConditions,
      }));
      
      // Find matching rule
      const matchingRule = this.findMatchingRule(
        rulesWithDetails,
        cartValue,
        weight,
        destination,
      );

      if (matchingRule) {
        let shippingRate = new Decimal(0);

        // Check if free shipping threshold is met
        if (
          matchingRule.freeShippingThreshold &&
          cartValue >= Number(matchingRule.freeShippingThreshold)
        ) {
          shippingRate = new Decimal(0);
        } else {
          // Calculate rate based on method type
          shippingRate = this.calculateRateByType(
            method.type,
            matchingRule,
            cartValue,
            weight,
          );
        }

        availableOptions.push({
          method: {
            id: method.id,
            name: method.name,
            description: method.description,
            type: method.type,
          },
          rule: {
            id: matchingRule.id,
            name: matchingRule.name,
            estimatedDays: matchingRule.estimatedDays,
          },
          rate: Number(shippingRate),
          freeShipping: shippingRate.eq(0),
        });
      }
    }

    // Sort by rate (lowest first)
    availableOptions.sort((a, b) => a.rate - b.rate);

    return availableOptions;
  }

  /**
   * Find matching shipping rule based on conditions
   */
  private findMatchingRule(
    rules: ShippingRuleWithDetails[],
    cartValue: number,
    weight: number,
    destination: ShippingDestination,
  ): ShippingRuleWithDetails | null {
    // Sort by priority (highest first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const conditions = rule.conditions as ShippingRuleConditions;

      // Check weight range
      if (conditions.weightRange) {
        if (
          conditions.weightRange.min !== undefined &&
          weight < conditions.weightRange.min
        ) {
          continue;
        }
        if (
          conditions.weightRange.max !== undefined &&
          weight > conditions.weightRange.max
        ) {
          continue;
        }
      }

      // Check cart value range
      if (conditions.cartValueRange) {
        if (
          conditions.cartValueRange.min !== undefined &&
          cartValue < conditions.cartValueRange.min
        ) {
          continue;
        }
        if (
          conditions.cartValueRange.max !== undefined &&
          cartValue > conditions.cartValueRange.max
        ) {
          continue;
        }
      }

      // Check country
      if (conditions.country && conditions.country !== destination.country) {
        continue;
      }

      // Check state
      if (
        conditions.state &&
        destination.state &&
        conditions.state !== destination.state
      ) {
        continue;
      }

      // Check city
      if (
        conditions.city &&
        destination.city &&
        conditions.city !== destination.city
      ) {
        continue;
      }

      // Check postal code (exact match or range)
      if (conditions.postalCode && destination.postalCode) {
        // Simple exact match - can be enhanced with range matching
        if (conditions.postalCode !== destination.postalCode) {
          continue;
        }
      }

      // All conditions matched
      return rule;
    }

    return null;
  }

  /**
   * Calculate shipping rate based on method type
   */
  private calculateRateByType(
    type: ShippingMethodType,
    rule: ShippingRuleWithDetails,
    cartValue: number,
    weight: number,
  ): Decimal {
    const baseRate = new Decimal(rule.rate);

    switch (type) {
      case ShippingMethodType.FLAT_RATE:
        // Flat rate - return as is
        return baseRate;

      case ShippingMethodType.WEIGHT_BASED:
        // Weight-based: rate per kg
        return baseRate.mul(weight);

      case ShippingMethodType.DISTANCE_BASED:
        // Distance-based: would need distance calculation
        // For now, return base rate
        // TODO: Integrate with geolocation service for distance calculation
        return baseRate;

      case ShippingMethodType.FREE_SHIPPING:
        // Free shipping - should be 0
        return new Decimal(0);

      case ShippingMethodType.PICKUP_IN_STORE:
        // Pickup in store - usually free
        return new Decimal(0);

      case ShippingMethodType.HYPERLOCAL:
        // Hyperlocal delivery - fixed rate or distance-based
        return baseRate;

      default:
        return baseRate;
    }
  }

  /**
   * Get shipping options for checkout
   */
  async getShippingOptions(
    cartItems: CartItemForShipping[],
    cartValue: number,
    destination: ShippingDestination,
    sellerId?: string,
  ): Promise<ShippingOption[]> {
    // Calculate total weight
    let totalWeight = 0;
    for (const item of cartItems) {
      if (item.weight) {
        totalWeight += item.weight * item.quantity;
      } else {
        // Default weight if not provided (0.5kg per item)
        totalWeight += 0.5 * item.quantity;
      }
    }

    return this.calculateShippingRate(
      totalWeight,
      cartValue,
      destination,
      sellerId,
    );
  }

  /**
   * Update shipping method
   */
  async updateShippingMethod(id: string, updateDto: Partial<CreateShippingMethodDto>) {
    await this.findShippingMethodById(id);

    return this.prisma.shippingMethod.update({
      where: { id },
      data: {
        ...updateDto,
      },
      include: {
        rules: true,
      },
    });
  }

  /**
   * Update shipping rule
   */
  async updateShippingRule(id: string, updateDto: Partial<CreateShippingRuleDto>) {
    const rule = await this.prisma.shippingRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Shipping rule not found');
    }

    const updateData: any = { ...updateDto };
    if (updateDto.rate !== undefined) {
      updateData.rate = new Decimal(updateDto.rate);
    }
    if (updateDto.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = updateDto.freeShippingThreshold
        ? new Decimal(updateDto.freeShippingThreshold)
        : null;
    }
    if (updateDto.conditions) {
      updateData.conditions = updateDto.conditions as any;
    }

    return this.prisma.shippingRule.update({
      where: { id },
      data: updateData,
      include: {
        shippingMethod: true,
      },
    });
  }
}
