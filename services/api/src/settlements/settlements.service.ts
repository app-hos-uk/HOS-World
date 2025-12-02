import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSettlementDto, ProcessSettlementDto } from './dto/create-settlement.dto';
import { SettlementStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  async calculateSettlement(
    sellerId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Get all paid orders in the period
    const orders = await this.prisma.order.findMany({
      where: {
        sellerId: seller.id,
        paymentStatus: 'PAID',
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        orderSettlements: {
          none: {}, // Not yet settled
        },
      },
      include: {
        items: true,
      },
    });

    let totalSales = new Decimal(0);
    let platformFees = new Decimal(0);
    const platformFeeRate = new Decimal(0.10); // 10% platform fee (configurable)

    for (const order of orders) {
      const orderTotal = new Decimal(order.total);
      totalSales = totalSales.add(orderTotal);
      const fee = orderTotal.mul(platformFeeRate);
      platformFees = platformFees.add(fee);
    }

    const netAmount = totalSales.sub(platformFees);

    return {
      sellerId: seller.id,
      sellerName: seller.storeName,
      periodStart,
      periodEnd,
      totalSales: Number(totalSales),
      totalOrders: orders.length,
      platformFee: Number(platformFees),
      netAmount: Number(netAmount),
      currency: 'USD',
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        createdAt: o.createdAt,
      })),
    };
  }

  async createSettlement(
    userId: string,
    createDto: CreateSettlementDto,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: createDto.sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Calculate settlement amounts
    const calculation = await this.calculateSettlement(
      createDto.sellerId,
      new Date(createDto.periodStart),
      new Date(createDto.periodEnd),
    );

    // Create settlement
    const settlement = await this.prisma.settlement.create({
      data: {
        sellerId: createDto.sellerId,
        periodStart: new Date(createDto.periodStart),
        periodEnd: new Date(createDto.periodEnd),
        totalSales: calculation.totalSales,
        totalOrders: calculation.totalOrders,
        platformFee: calculation.platformFee,
        netAmount: calculation.netAmount,
        currency: calculation.currency,
        status: 'PENDING',
        notes: createDto.notes,
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

    // Create order-settlement relationships
    for (const order of calculation.orders) {
      const orderFee = new Decimal(order.total).mul(new Decimal(0.10));
      await this.prisma.orderSettlement.create({
        data: {
          settlementId: settlement.id,
          orderId: order.id,
          amount: order.total,
          platformFee: Number(orderFee),
        },
      });
    }

    return settlement;
  }

  async getSellerIdByUserId(userId: string): Promise<string | null> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    return seller?.id || null;
  }

  async findAll(sellerId?: string, status?: SettlementStatus) {
    const where: any = {};
    if (sellerId) {
      where.sellerId = sellerId;
    }
    if (status) {
      where.status = status;
    }

    return this.prisma.settlement.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        orderSettlements: {
          take: 10,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            userId: true,
          },
        },
        orderSettlements: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
                createdAt: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return settlement;
  }

  async processSettlement(id: string, processDto: ProcessSettlementDto) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot process settlement in status: ${settlement.status}`,
      );
    }

    return this.prisma.settlement.update({
      where: { id },
      data: {
        status: processDto.status,
        paymentMethod: processDto.paymentMethod,
        paidAt: processDto.status === 'PAID' ? new Date() : null,
        notes: processDto.notes,
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
}

