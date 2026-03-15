import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSettlementDto, ProcessSettlementDto } from './dto/create-settlement.dto';
import { SettlementStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CurrencyService } from '../currency/currency.service';
import { StripeConnectService } from '../payments/stripe-connect/stripe-connect.service';

@Injectable()
export class SettlementsService {
  private readonly BASE_CURRENCY = 'USD';
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    private prisma: PrismaService,
    private currencyService: CurrencyService,
    @Optional() private stripeConnectService?: StripeConnectService,
  ) {}

  async calculateSettlement(sellerId: string, periodStart: Date, periodEnd: Date) {
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
    const platformFeeRate = new Decimal(0.1); // 10% platform fee (configurable)

    for (const order of orders) {
      let orderTotalBase: Decimal;
      if (order.currency === this.BASE_CURRENCY) {
        orderTotalBase = new Decimal(order.total);
      } else {
        const convertedAmount = await this.currencyService.convertBetween(
          Number(order.total),
          order.currency,
          this.BASE_CURRENCY,
        );
        orderTotalBase = new Decimal(convertedAmount);
      }

      totalSales = totalSales.add(orderTotalBase);
      const fee = orderTotalBase.mul(platformFeeRate);
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
      currency: this.BASE_CURRENCY,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        currency: o.currency,
        createdAt: o.createdAt,
      })),
    };
  }

  async createSettlement(userId: string, createDto: CreateSettlementDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: createDto.sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const calculation = await this.calculateSettlement(
      createDto.sellerId,
      new Date(createDto.periodStart),
      new Date(createDto.periodEnd),
    );

    if (calculation.totalOrders === 0) {
      throw new BadRequestException('No unsettled orders found for this period');
    }

    // Pre-compute currency conversions before entering transaction
    const orderConversions: { orderId: string; amountBase: number }[] = [];
    for (const order of calculation.orders) {
      let amountBase: number;
      if (order.currency === this.BASE_CURRENCY) {
        amountBase = order.total;
      } else {
        amountBase = await this.currencyService.convertBetween(
          order.total,
          order.currency,
          this.BASE_CURRENCY,
        );
      }
      orderConversions.push({ orderId: order.id, amountBase });
    }

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
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

      for (const { orderId, amountBase } of orderConversions) {
        const orderFee = new Decimal(amountBase).mul(new Decimal(0.1));
        await tx.orderSettlement.create({
          data: {
            settlementId: settlement.id,
            orderId,
            amount: amountBase,
            platformFee: Number(orderFee),
          },
        });
      }

      return settlement;
    });
  }

  async getSellerIdByUserId(userId: string): Promise<string | null> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    return seller?.id || null;
  }

  async findAll(sellerId?: string, status?: SettlementStatus, page = 1, limit = 50) {
    const where: any = {};
    if (sellerId) {
      where.sellerId = sellerId;
    }
    if (status) {
      where.status = status;
    }

    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    return this.prisma.settlement.findMany({
      where,
      skip,
      take,
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
      include: { seller: true },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException(`Cannot process settlement in status: ${settlement.status}`);
    }

    // If marking as PAID, trigger Stripe Connect transfer
    if (processDto.status === 'PAID' && this.stripeConnectService) {
      const seller = settlement.seller;
      if (seller?.stripeConnectAccountId && seller.stripeConnectPayoutsEnabled) {
        try {
          await this.stripeConnectService.transferToVendor({
            amount: Number(settlement.netAmount),
            currency: settlement.currency.toLowerCase(),
            vendorAccountId: seller.stripeConnectAccountId,
            description: `Settlement ${id} payout`,
            orderId: id,
          });
          this.logger.log(`Stripe transfer completed for settlement ${id}`);
        } catch (error) {
          this.logger.error(`Stripe transfer failed for settlement ${id}:`, error);
          throw new BadRequestException('Stripe payout transfer failed. Settlement not processed.');
        }
      }
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
