import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InventoryPrismaService } from '../database/prisma.service';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private prisma: InventoryPrismaService) {}

  async createShippingMethod(data: {
    name: string;
    description?: string;
    type?: string;
    isActive?: boolean;
    sellerId?: string;
  }) {
    return this.prisma.shippingMethod.create({
      data: { ...data, isActive: data.isActive ?? true },
      include: { rules: true },
    });
  }

  async findAllShippingMethods(sellerId?: string) {
    return this.prisma.shippingMethod.findMany({
      where: {
        isActive: true,
        ...(sellerId ? { sellerId } : { sellerId: null }),
      },
      include: { rules: { where: { isActive: true }, orderBy: { priority: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findShippingMethodById(id: string) {
    const method = await this.prisma.shippingMethod.findUnique({
      where: { id },
      include: { rules: { orderBy: { priority: 'desc' } } },
    });
    if (!method) throw new NotFoundException('Shipping method not found');
    return method;
  }

  async createShippingRule(data: {
    shippingMethodId: string;
    name: string;
    priority?: number;
    conditions?: any;
    rate: number;
    freeShippingThreshold?: number;
    estimatedDays?: number;
    isActive?: boolean;
  }) {
    await this.findShippingMethodById(data.shippingMethodId);
    return this.prisma.shippingRule.create({
      data: {
        shippingMethodId: data.shippingMethodId,
        name: data.name,
        priority: data.priority || 0,
        conditions: data.conditions || {},
        rate: data.rate,
        freeShippingThreshold: data.freeShippingThreshold,
        estimatedDays: data.estimatedDays,
        isActive: data.isActive ?? true,
      },
      include: { shippingMethod: true },
    });
  }

  async calculateShippingRate(weight: number, cartValue: number, destination: any, sellerId?: string) {
    const methods = await this.findAllShippingMethods(sellerId);
    const options: any[] = [];

    for (const method of methods) {
      const rules = method.rules || [];
      for (const rule of rules) {
        const rate = Number(rule.rate);
        const threshold = rule.freeShippingThreshold ? Number(rule.freeShippingThreshold) : null;
        const isFree = threshold && cartValue >= threshold;
        options.push({
          method: { id: method.id, name: method.name, type: method.type },
          rule: { id: rule.id, name: rule.name, estimatedDays: rule.estimatedDays },
          rate: isFree ? 0 : rate,
          freeShipping: !!isFree,
        });
      }
    }

    options.sort((a, b) => a.rate - b.rate);
    return options;
  }
}
