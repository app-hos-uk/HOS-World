import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import { CreateShippingRuleDto } from './dto/create-shipping-rule.dto';
import {
  CreateShippingCarrierDto,
  UpdateShippingCarrierDto,
} from './dto/create-shipping-carrier.dto';
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

  async getSellerByUserId(userId: string) {
    return this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

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
        minimumCharge: rule.minimumCharge != null ? Number(rule.minimumCharge) : null,
        freeShippingThreshold:
          rule.freeShippingThreshold != null ? Number(rule.freeShippingThreshold) : null,
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
        minimumCharge: rule.minimumCharge != null ? Number(rule.minimumCharge) : null,
        freeShippingThreshold:
          rule.freeShippingThreshold != null ? Number(rule.freeShippingThreshold) : null,
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
        minimumCharge:
          createDto.minimumCharge != null ? new Decimal(createDto.minimumCharge) : null,
        freeShippingThreshold:
          createDto.freeShippingThreshold != null
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
        minimumCharge: rule.minimumCharge != null ? Number(rule.minimumCharge) : null,
        freeShippingThreshold:
          rule.freeShippingThreshold != null ? Number(rule.freeShippingThreshold) : null,
        conditions: rule.conditions as ShippingRuleConditions,
      }));

      // Find matching rule
      const matchingRule = this.findMatchingRule(rulesWithDetails, cartValue, weight, destination);

      if (matchingRule) {
        let shippingRate = new Decimal(0);

        // Check if free shipping threshold is met
        if (
          matchingRule.freeShippingThreshold != null &&
          cartValue >= Number(matchingRule.freeShippingThreshold)
        ) {
          shippingRate = new Decimal(0);
        } else {
          // Calculate rate based on method type, then enforce minimum charge floor
          shippingRate = this.calculateRateByType(method.type, matchingRule, cartValue, weight);
          const skipMinimumFloor =
            method.type === 'FREE_SHIPPING' || method.type === 'PICKUP_IN_STORE';
          const minimumCharge = Number(matchingRule.minimumCharge);
          if (
            !skipMinimumFloor &&
            Number.isFinite(minimumCharge) &&
            minimumCharge > 0 &&
            shippingRate.lt(minimumCharge)
          ) {
            shippingRate = new Decimal(minimumCharge);
          }
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
   * Normalize country values so "United States" matches rule country "US", etc.
   */
  private normalizeCountryCode(country?: string | null): string | undefined {
    if (!country) return undefined;
    const trimmed = country.trim();
    if (!trimmed) return undefined;
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const aliases: Record<string, string> = {
      'UNITED STATES': 'US',
      'UNITED STATES OF AMERICA': 'US',
      USA: 'US',
      'U.S.': 'US',
      'U.S.A.': 'US',
      'U.S.A': 'US',
      'UNITED KINGDOM': 'GB',
      UK: 'GB',
      'GREAT BRITAIN': 'GB',
      ENGLAND: 'GB',
      CANADA: 'CA',
      AUSTRALIA: 'AU',
      GERMANY: 'DE',
      FRANCE: 'FR',
      IRELAND: 'IE',
      'NEW ZEALAND': 'NZ',
      INDIA: 'IN',
      'UNITED ARAB EMIRATES': 'AE',
      UAE: 'AE',
    };
    return aliases[trimmed.toUpperCase()] || trimmed.toUpperCase();
  }

  private countriesMatch(ruleCountry: string, destinationCountry?: string): boolean {
    const normalizedRule = this.normalizeCountryCode(ruleCountry);
    const normalizedDest = this.normalizeCountryCode(destinationCountry);
    if (!normalizedRule || !normalizedDest) return false;
    return normalizedRule === normalizedDest;
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
        if (conditions.weightRange.min !== undefined && weight < conditions.weightRange.min) {
          continue;
        }
        if (conditions.weightRange.max !== undefined && weight > conditions.weightRange.max) {
          continue;
        }
      }

      // Check cart value range (supports both cartValueRange object and minCartValue shorthand)
      const extConditions = conditions as ShippingRuleConditions & {
        minCartValue?: number;
        countries?: string[];
      };
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
      } else if (
        extConditions.minCartValue !== undefined &&
        cartValue < extConditions.minCartValue
      ) {
        // Shorthand: minCartValue means cart must be at least this amount
        continue;
      }

      // Check country (supports ISO codes and full names on either side)
      if (conditions.country && !this.countriesMatch(conditions.country, destination.country)) {
        continue;
      }
      if (extConditions.countries && extConditions.countries.length > 0) {
        const countryMatches = extConditions.countries.some((c) =>
          this.countriesMatch(c, destination.country),
        );
        if (!countryMatches) {
          continue;
        }
      }

      // Check state
      if (conditions.state && destination.state && conditions.state !== destination.state) {
        continue;
      }

      // Check city
      if (conditions.city && destination.city && conditions.city !== destination.city) {
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

    return this.calculateShippingRate(totalWeight, cartValue, destination, sellerId);
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
    if (updateDto.minimumCharge !== undefined) {
      updateData.minimumCharge =
        updateDto.minimumCharge != null ? new Decimal(updateDto.minimumCharge) : null;
    }
    if (updateDto.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold =
        updateDto.freeShippingThreshold != null
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

  /** Delete a shipping method and its associated rules */
  async deleteMethod(id: string) {
    const method = await this.prisma.shippingMethod.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Shipping method not found');
    }
    await this.prisma.shippingRule.deleteMany({ where: { shippingMethodId: id } });
    await this.prisma.shippingMethod.delete({ where: { id } });
  }

  /** Delete a shipping rule */
  async deleteRule(id: string) {
    const rule = await this.prisma.shippingRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Shipping rule not found');
    }
    await this.prisma.shippingRule.delete({ where: { id } });
  }

  /** Admin: list all platform shipping methods including inactive */
  async findAllShippingMethodsAdmin(): Promise<ShippingMethodWithRules[]> {
    const methods = await this.prisma.shippingMethod.findMany({
      where: { sellerId: null },
      include: {
        rules: { orderBy: { priority: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return methods.map((method) => ({
      ...method,
      rules: (method.rules || []).map((rule: any) => ({
        ...rule,
        rate: Number(rule.rate),
        minimumCharge: rule.minimumCharge != null ? Number(rule.minimumCharge) : null,
        freeShippingThreshold:
          rule.freeShippingThreshold != null ? Number(rule.freeShippingThreshold) : null,
        conditions: rule.conditions as ShippingRuleConditions,
      })) as ShippingRuleWithDetails[],
    })) as ShippingMethodWithRules[];
  }

  // ─── Manual shipping carriers (admin-managed) ───────────────────────────

  async findActiveShippingCarriers() {
    return this.prisma.shippingCarrier.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        trackingUrlTemplate: true,
        allowCustomName: true,
        sortOrder: true,
      },
    });
  }

  async findAllShippingCarriersAdmin() {
    return this.prisma.shippingCarrier.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createShippingCarrier(dto: CreateShippingCarrierDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Carrier name is required');
    }

    const existing = await this.prisma.shippingCarrier.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Carrier "${name}" already exists`);
    }

    const code = dto.code?.trim() || null;
    if (code) {
      const codeTaken = await this.prisma.shippingCarrier.findUnique({ where: { code } });
      if (codeTaken) {
        throw new BadRequestException(`Carrier code "${code}" already exists`);
      }
    }

    return this.prisma.shippingCarrier.create({
      data: {
        name,
        code,
        trackingUrlTemplate: dto.trackingUrlTemplate?.trim() || null,
        isActive: dto.isActive ?? true,
        allowCustomName: dto.allowCustomName ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateShippingCarrier(id: string, dto: UpdateShippingCarrierDto) {
    const carrier = await this.prisma.shippingCarrier.findUnique({ where: { id } });
    if (!carrier) {
      throw new NotFoundException('Shipping carrier not found');
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Carrier name is required');
      }
      const nameTaken = await this.prisma.shippingCarrier.findFirst({
        where: { name, NOT: { id } },
      });
      if (nameTaken) {
        throw new BadRequestException(`Carrier "${name}" already exists`);
      }
    }

    if (dto.code !== undefined && dto.code !== null && String(dto.code).trim()) {
      const code = String(dto.code).trim();
      const codeTaken = await this.prisma.shippingCarrier.findFirst({
        where: { code, NOT: { id } },
      });
      if (codeTaken) {
        throw new BadRequestException(`Carrier code "${code}" already exists`);
      }
    }

    return this.prisma.shippingCarrier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined
          ? { code: dto.code === null || !String(dto.code).trim() ? null : String(dto.code).trim() }
          : {}),
        ...(dto.trackingUrlTemplate !== undefined
          ? {
              trackingUrlTemplate:
                dto.trackingUrlTemplate === null || !String(dto.trackingUrlTemplate).trim()
                  ? null
                  : String(dto.trackingUrlTemplate).trim(),
            }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.allowCustomName !== undefined ? { allowCustomName: dto.allowCustomName } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deleteShippingCarrier(id: string) {
    const carrier = await this.prisma.shippingCarrier.findUnique({ where: { id } });
    if (!carrier) {
      throw new NotFoundException('Shipping carrier not found');
    }
    await this.prisma.shippingCarrier.delete({ where: { id } });
  }

  /** Seed default platform shipping options when none exist */
  async ensurePlatformShippingDefaults(): Promise<number> {
    const existing = await this.prisma.shippingMethod.count({
      where: { sellerId: null, isActive: true },
    });
    if (existing > 0) return 0;

    const standard = await this.prisma.shippingMethod.create({
      data: {
        name: 'Standard Delivery',
        description: '5–7 business days',
        type: 'FLAT_RATE',
        isActive: true,
        sellerId: null,
      },
    });
    await this.prisma.shippingRule.create({
      data: {
        shippingMethodId: standard.id,
        name: 'Standard US',
        priority: 10,
        rate: new Decimal(5.99),
        freeShippingThreshold: new Decimal(75),
        estimatedDays: 7,
        conditions: { country: 'US' } as any,
        isActive: true,
      },
    });

    const express = await this.prisma.shippingMethod.create({
      data: {
        name: 'Express Delivery',
        description: '2–3 business days',
        type: 'FLAT_RATE',
        isActive: true,
        sellerId: null,
      },
    });
    await this.prisma.shippingRule.create({
      data: {
        shippingMethodId: express.id,
        name: 'Express US',
        priority: 20,
        rate: new Decimal(12.99),
        estimatedDays: 3,
        conditions: { country: 'US' } as any,
        isActive: true,
      },
    });

    this.logger.log('Seeded default platform shipping methods');
    return 2;
  }
}
