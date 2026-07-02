import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const ALLOWED_TRANSACTION_TYPES = ['PAYMENT', 'PAYOUT', 'REFUND', 'FEE', 'ADJUSTMENT'] as const;
type TransactionType = (typeof ALLOWED_TRANSACTION_TYPES)[number];

// Must stay aligned with CurrencyService.DEFAULT_SUPPORTED and GLOBAL_SUPPORTED_CURRENCIES env
const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'JPY', 'AUD', 'CAD', 'SGD'] as const;

@Injectable()
export class TransactionsService implements OnModuleInit {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Auto-backfill on startup: create Transaction records for paid orders that lack them
    try {
      const result = await this.backfillFromOrders();
      if (result.created > 0) {
        this.logger.log(`Auto-backfill: ${result.created} transactions created from paid orders`);
      }
    } catch (err: any) {
      this.logger.warn(`Auto-backfill failed: ${err?.message}`);
    }
  }

  async createTransaction(data: {
    type: TransactionType;
    amount: number;
    currency?: string;
    sellerId?: string;
    customerId?: string;
    orderId?: string;
    settlementId?: string;
    returnId?: string;
    description?: string;
    metadata?: any;
    status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  }) {
    if (!ALLOWED_TRANSACTION_TYPES.includes(data.type)) {
      throw new BadRequestException(
        `Invalid transaction type "${data.type}". Allowed: ${ALLOWED_TRANSACTION_TYPES.join(', ')}`,
      );
    }

    if (data.currency && !ALLOWED_CURRENCIES.includes(data.currency as any)) {
      throw new BadRequestException(
        `Unsupported currency "${data.currency}". Allowed: ${ALLOWED_CURRENCIES.join(', ')}`,
      );
    }

    // Validate related entities exist
    if (data.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId },
      });
      if (!seller) {
        throw new NotFoundException('Seller not found');
      }
    }

    if (data.customerId) {
      const customer = await this.prisma.user.findUnique({
        where: { id: data.customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
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

    if (data.settlementId) {
      const settlement = await this.prisma.settlement.findUnique({
        where: { id: data.settlementId },
      });
      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }
    }

    if (data.returnId) {
      const returnRequest = await this.prisma.returnRequest.findUnique({
        where: { id: data.returnId },
      });
      if (!returnRequest) {
        throw new NotFoundException('Return request not found');
      }
    }

    return this.prisma.transaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status || 'PENDING',
        sellerId: data.sellerId,
        customerId: data.customerId,
        orderId: data.orderId,
        settlementId: data.settlementId,
        returnId: data.returnId,
        description: data.description,
        metadata: data.metadata || {},
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        settlement: {
          select: {
            id: true,
            netAmount: true,
            status: true,
          },
        },
        returnRequest: {
          select: {
            id: true,
            refundAmount: true,
            status: true,
          },
        },
      },
    });
  }

  async getTransactions(filters?: {
    sellerId?: string;
    customerId?: string;
    orderId?: string;
    settlementId?: string;
    returnId?: string;
    type?: string;
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

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters?.settlementId) {
      where.settlementId = filters.settlementId;
    }

    if (filters?.returnId) {
      where.returnId = filters.returnId;
    }

    if (filters?.type) {
      where.type = filters.type;
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

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
            },
          },
          settlement: {
            select: {
              id: true,
              netAmount: true,
              status: true,
            },
          },
          returnRequest: {
            select: {
              id: true,
              refundAmount: true,
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
      this.prisma.transaction.count({ where }),
    ]);

    // Calculate running balances
    const balances = await this.calculateBalances(transactions);

    return {
      transactions,
      balances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionById(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        settlement: {
          select: {
            id: true,
            netAmount: true,
            status: true,
          },
        },
        returnRequest: {
          select: {
            id: true,
            refundAmount: true,
            status: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async updateTransactionStatus(
    id: string,
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    options?: { changedById?: string; reason?: string },
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const previousStatus = transaction.status;

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.prisma.transactionAuditLog.create({
      data: {
        transactionId: id,
        previousStatus,
        newStatus: status,
        changedById: options?.changedById,
        reason: options?.reason,
      },
    });

    return updated;
  }

  private async calculateBalances(transactions: any[]) {
    let totalInflow = 0;
    let totalOutflow = 0;
    const bySeller: Record<string, { inflow: number; outflow: number }> = {};
    const byCustomer: Record<string, { inflow: number; outflow: number }> = {};

    for (const tx of transactions) {
      if (tx.status !== 'COMPLETED') {
        continue;
      }
      const amount = Number(tx.amount);
      if (tx.type === 'PAYMENT' || tx.type === 'FEE') {
        totalInflow += amount;
        if (tx.sellerId) {
          if (!bySeller[tx.sellerId]) {
            bySeller[tx.sellerId] = { inflow: 0, outflow: 0 };
          }
          bySeller[tx.sellerId].inflow += amount;
        }
        if (tx.customerId) {
          if (!byCustomer[tx.customerId]) {
            byCustomer[tx.customerId] = { inflow: 0, outflow: 0 };
          }
          byCustomer[tx.customerId].outflow += amount;
        }
      } else if (tx.type === 'PAYOUT' || tx.type === 'REFUND') {
        totalOutflow += amount;
        if (tx.sellerId) {
          if (!bySeller[tx.sellerId]) {
            bySeller[tx.sellerId] = { inflow: 0, outflow: 0 };
          }
          bySeller[tx.sellerId].outflow += amount;
        }
        if (tx.customerId) {
          if (!byCustomer[tx.customerId]) {
            byCustomer[tx.customerId] = { inflow: 0, outflow: 0 };
          }
          byCustomer[tx.customerId].inflow += amount;
        }
      }
    }

    return {
      total: totalInflow - totalOutflow,
      totalInflow,
      totalOutflow,
      bySeller,
      byCustomer,
    };
  }

  async exportTransactions(filters?: {
    sellerId?: string;
    customerId?: string;
    type?: string;
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

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.type) {
      where.type = filters.type;
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
    const limit = Math.min(filters?.limit || 1000, 5000);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          seller: {
            select: {
              storeName: true,
              slug: true,
            },
          },
          customer: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Backfill Transaction records for paid orders that were processed before
   * the transaction-creation logic was added to markPaymentAsPaid.
   */
  async backfillFromOrders(): Promise<{ created: number; skipped: number }> {
    const existingOrderIds = await this.prisma.transaction.findMany({
      where: { type: 'PAYMENT', orderId: { not: null } },
      select: { orderId: true },
    });
    const existingSet = new Set(existingOrderIds.map((t) => t.orderId));

    const paidOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        parentOrderId: null,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        sellerId: true,
        orderNumber: true,
        total: true,
        currency: true,
        createdAt: true,
        payments: {
          where: { status: 'PAID' },
          select: { stripePaymentId: true, amount: true, currency: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let created = 0;
    let skipped = 0;

    for (const order of paidOrders) {
      if (existingSet.has(order.id)) {
        skipped++;
        continue;
      }

      const payment = order.payments[0];
      const amount = payment ? Number(payment.amount) : Number(order.total);
      const currency = payment?.currency || order.currency || 'USD';

      try {
        await this.prisma.transaction.create({
          data: {
            type: 'PAYMENT',
            amount,
            currency,
            status: 'COMPLETED',
            customerId: order.userId,
            sellerId: order.sellerId || undefined,
            orderId: order.id,
            description: `Payment for order ${order.orderNumber || order.id}`,
            metadata: {
              backfilled: true,
              stripePaymentId: payment?.stripePaymentId || null,
            },
            createdAt: order.createdAt,
          },
        });
        created++;
      } catch (err: any) {
        this.logger.warn(`Backfill failed for order ${order.id}: ${err?.message}`);
        skipped++;
      }
    }

    this.logger.log(`Backfill complete: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }
}
