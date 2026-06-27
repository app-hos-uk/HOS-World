import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreateSettlementDto, ProcessSettlementDto } from './dto/create-settlement.dto';
import { SettlementStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { resolvePlatformFeeRate } from '../common/platform-config';
import { CurrencyService } from '../currency/currency.service';
import { StripeConnectService } from '../payments/stripe-connect/stripe-connect.service';

@Injectable()
export class SettlementsService {
  private readonly BASE_CURRENCY = 'USD';
  private readonly logger = new Logger(SettlementsService.name);
  private readonly defaultFeeRate: number;

  constructor(
    private prisma: PrismaService,
    private currencyService: CurrencyService,
    private configService: ConfigService,
    @Optional() private stripeConnectService?: StripeConnectService,
  ) {
    this.defaultFeeRate = resolvePlatformFeeRate(this.configService);
  }

  async calculateSettlement(sellerId: string, periodStart: Date, periodEnd: Date) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Get all paid orders in the period, excluding orders already paid out via
    // Stripe Connect split (platformFeeAmount > 0 indicates funds were routed to vendor at payment time).
    const orders = await this.prisma.order.findMany({
      where: {
        sellerId: seller.id,
        paymentStatus: 'PAID',
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        orderSettlements: {
          none: {},
        },
        OR: [
          { platformFeeAmount: null },
          { platformFeeAmount: { lte: 0 } },
        ],
      },
      include: {
        items: true,
      },
    });

    let totalSales = new Decimal(0);
    let platformFees = new Decimal(0);
    const platformFeeRate = new Decimal(
      (seller as any).commissionRate ?? this.defaultFeeRate,
    );

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

      // Use the same fee rate from calculation (seller's commissionRate or configured default)
      const feeRate = new Decimal(
        (seller as any).commissionRate ?? this.defaultFeeRate,
      );

      for (const { orderId, amountBase } of orderConversions) {
        const orderFee = new Decimal(amountBase).mul(feeRate);
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

    // If marking as PAID, trigger Stripe Connect transfer — but ONLY for orders that
    // were NOT already paid out via Connect split (application_fee_amount) at checkout.
    // Orders paid via Connect split already transferred funds to the vendor account at payment time;
    // issuing a second transfer here would result in a double payout.
    if (processDto.status === 'PAID' && this.stripeConnectService) {
      const seller = settlement.seller;
      if (seller?.stripeConnectAccountId && seller.stripeConnectPayoutsEnabled) {
        // Check how many settlement orders used Connect split (have platformFeeAmount > 0, indicating
        // the platform took an application_fee and routed funds to the vendor at payment time).
        const settlementOrders = await this.prisma.orderSettlement.findMany({
          where: { settlementId: id },
          include: {
            order: {
              select: {
                id: true,
                total: true,
                platformFeeAmount: true,
                stripePaymentIntentId: true,
              },
            },
          },
        });

        // Only transfer for orders that were NOT paid via Connect split
        let nonSplitTotal = new Decimal(0);
        for (const so of settlementOrders) {
          const usedConnectSplit =
            Number(so.order.platformFeeAmount ?? 0) > 0 && so.order.stripePaymentIntentId;
          if (!usedConnectSplit) {
            nonSplitTotal = nonSplitTotal.add(new Decimal(so.amount));
          }
        }

        // Apply same fee rate to get net payout for non-split orders
        const feeRate = new Decimal(
          (seller as any).commissionRate ?? this.defaultFeeRate,
        );
        const nonSplitFee = nonSplitTotal.mul(feeRate);
        const transferAmount = Number(nonSplitTotal.sub(nonSplitFee));

        if (transferAmount > 0) {
          try {
            await this.stripeConnectService.transferToVendor({
              amount: transferAmount,
              currency: settlement.currency.toLowerCase(),
              vendorAccountId: seller.stripeConnectAccountId,
              description: `Settlement ${id} payout (non-split orders only)`,
              orderId: id,
            });
            this.logger.log(
              `Stripe transfer of ${transferAmount} completed for settlement ${id} (skipped ${settlementOrders.length - settlementOrders.filter((so: any) => !Number(so.order.platformFeeAmount ?? 0)).length} Connect-split orders)`,
            );
          } catch (error) {
            this.logger.error(`Stripe transfer failed for settlement ${id}:`, error);
            throw new BadRequestException('Stripe payout transfer failed. Settlement not processed.');
          }
        } else {
          this.logger.log(
            `Settlement ${id}: all orders were paid via Connect split — no additional transfer needed`,
          );
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
