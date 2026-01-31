import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DiscrepanciesService {
  constructor(private prisma: PrismaService) {}

  async createDiscrepancy(data: {
    type: 'INVENTORY' | 'PRICING' | 'SETTLEMENT' | 'ORDER_FULFILLMENT';
    sellerId?: string;
    orderId?: string;
    productId?: string;
    settlementId?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    expectedValue?: any;
    actualValue?: any;
    description: string;
  }) {
    // Validate related entities exist
    if (data.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId },
      });
      if (!seller) {
        throw new NotFoundException('Seller not found');
      }
    }

    if (data.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
    }

    if (data.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    if (data.settlementId) {
      const settlement = await this.prisma.settlement.findUnique({
        where: { id: data.settlementId },
      });
      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }
    }

    return this.prisma.discrepancy.create({
      data: {
        type: data.type,
        sellerId: data.sellerId,
        orderId: data.orderId,
        productId: data.productId,
        settlementId: data.settlementId,
        severity: data.severity || 'MEDIUM',
        expectedValue: data.expectedValue || {},
        actualValue: data.actualValue || {},
        description: data.description,
        status: 'OPEN',
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        settlement: {
          select: {
            id: true,
            netAmount: true,
            status: true,
          },
        },
      },
    });
  }

  async getDiscrepancies(filters?: {
    sellerId?: string;
    type?: string;
    severity?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.severity) {
      where.severity = filters.severity;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [discrepancies, total] = await Promise.all([
      this.prisma.discrepancy.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          settlement: {
            select: {
              id: true,
              netAmount: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.discrepancy.count({ where }),
    ]);

    return {
      discrepancies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDiscrepancyById(id: string) {
    const discrepancy = await this.prisma.discrepancy.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        settlement: {
          select: {
            id: true,
            netAmount: true,
            status: true,
          },
        },
      },
    });

    if (!discrepancy) {
      throw new NotFoundException('Discrepancy not found');
    }

    return discrepancy;
  }

  async resolveDiscrepancy(id: string, resolvedBy: string, resolution: string) {
    const discrepancy = await this.prisma.discrepancy.findUnique({
      where: { id },
    });

    if (!discrepancy) {
      throw new NotFoundException('Discrepancy not found');
    }

    if (discrepancy.status !== 'OPEN' && discrepancy.status !== 'INVESTIGATING') {
      throw new BadRequestException('Discrepancy is not in a resolvable state');
    }

    return this.prisma.discrepancy.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedBy,
        resolvedAt: new Date(),
        resolution,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });
  }

  async getSellerDiscrepancies(
    sellerId: string,
    filters?: {
      type?: string;
      severity?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    return this.getDiscrepancies({
      ...filters,
      sellerId,
    });
  }

  // Auto-detect discrepancies
  async detectInventoryDiscrepancy(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if stock is negative
    if (product.stock < 0) {
      return this.createDiscrepancy({
        type: 'INVENTORY',
        sellerId: product.sellerId || undefined,
        productId,
        severity: 'HIGH',
        expectedValue: { stock: '>= 0' },
        actualValue: { stock: product.stock },
        description: `Product "${product.name}" has negative stock: ${product.stock}`,
      });
    }

    return null;
  }

  async detectPricingDiscrepancy(productId: string, expectedPrice: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const actualPrice = Number(product.price);
    const difference = Math.abs(actualPrice - expectedPrice);
    const percentageDiff = (difference / expectedPrice) * 100;

    // Flag if price difference is more than 10%
    if (percentageDiff > 10) {
      return this.createDiscrepancy({
        type: 'PRICING',
        sellerId: product.sellerId || undefined,
        productId,
        severity: percentageDiff > 50 ? 'CRITICAL' : percentageDiff > 25 ? 'HIGH' : 'MEDIUM',
        expectedValue: { price: expectedPrice },
        actualValue: { price: actualPrice },
        description: `Product "${product.name}" price discrepancy: Expected ${expectedPrice}, Actual ${actualPrice} (${percentageDiff.toFixed(2)}% difference)`,
      });
    }

    return null;
  }
}
