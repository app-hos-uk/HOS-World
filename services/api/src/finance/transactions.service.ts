import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async createTransaction(data: {
    type: 'PAYMENT' | 'PAYOUT' | 'REFUND' | 'FEE' | 'ADJUSTMENT';
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
        currency: data.currency || 'GBP',
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
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.transaction.update({
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
  }

  private async calculateBalances(transactions: any[]) {
    let totalInflow = 0;
    let totalOutflow = 0;
    const bySeller: Record<string, { inflow: number; outflow: number }> = {};
    const byCustomer: Record<string, { inflow: number; outflow: number }> = {};

    for (const tx of transactions) {
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

    return this.prisma.transaction.findMany({
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
    });
  }
}
