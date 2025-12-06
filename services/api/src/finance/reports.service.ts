import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getRevenueReport(filters?: {
    startDate?: Date;
    endDate?: Date;
    sellerId?: string;
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  }) {
    const where: any = {
      type: 'PAYMENT',
      status: 'COMPLETED',
    };

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    const transactions = await this.prisma.transaction.findMany({
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
      },
    });

    const totalRevenue = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalTransactions = transactions.length;

    // Group by period if specified
    let groupedData: any = {};
    if (filters?.period) {
      transactions.forEach((tx) => {
        const date = new Date(tx.createdAt);
        let key: string;
        if (filters.period === 'daily') {
          key = date.toISOString().split('T')[0];
        } else if (filters.period === 'weekly') {
          const week = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${week}`;
        } else if (filters.period === 'monthly') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          key = String(date.getFullYear());
        }

        if (!groupedData[key]) {
          groupedData[key] = { revenue: 0, transactions: 0 };
        }
        groupedData[key].revenue += Number(tx.amount);
        groupedData[key].transactions += 1;
      });
    }

    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      groupedData: Object.keys(groupedData).length > 0 ? groupedData : undefined,
      transactions: transactions.slice(0, 100), // Limit to 100 most recent
    };
  }

  async getSellerPerformance(filters?: {
    startDate?: Date;
    endDate?: Date;
    sellerId?: string;
  }) {
    const where: any = {
      type: 'PAYMENT',
      status: 'COMPLETED',
    };

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    const transactions = await this.prisma.transaction.findMany({
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
      },
    });

    // Group by seller
    const bySeller: Record<string, any> = {};
    transactions.forEach((tx) => {
      if (!tx.sellerId) return;
      if (!bySeller[tx.sellerId]) {
        bySeller[tx.sellerId] = {
          seller: tx.seller,
          revenue: 0,
          transactions: 0,
          orders: new Set(),
        };
      }
      bySeller[tx.sellerId].revenue += Number(tx.amount);
      bySeller[tx.sellerId].transactions += 1;
      if (tx.orderId) {
        bySeller[tx.sellerId].orders.add(tx.orderId);
      }
    });

    // Convert to array and calculate metrics
    const performance = Object.values(bySeller).map((data: any) => ({
      seller: data.seller,
      revenue: data.revenue,
      transactions: data.transactions,
      orders: data.orders.size,
      averageOrderValue: data.orders.size > 0 ? data.revenue / data.orders.size : 0,
    }));

    // Sort by revenue descending
    performance.sort((a, b) => b.revenue - a.revenue);

    return performance;
  }

  async getCustomerSpending(filters?: {
    startDate?: Date;
    endDate?: Date;
    customerId?: string;
  }) {
    const where: any = {
      type: 'PAYMENT',
      status: 'COMPLETED',
    };

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
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
      },
    });

    // Group by customer
    const byCustomer: Record<string, any> = {};
    transactions.forEach((tx) => {
      if (!tx.customerId) return;
      if (!byCustomer[tx.customerId]) {
        byCustomer[tx.customerId] = {
          customer: tx.customer,
          totalSpent: 0,
          transactions: 0,
          orders: new Set(),
        };
      }
      byCustomer[tx.customerId].totalSpent += Number(tx.amount);
      byCustomer[tx.customerId].transactions += 1;
      if (tx.orderId) {
        byCustomer[tx.customerId].orders.add(tx.orderId);
      }
    });

    // Convert to array
    const spending = Object.values(byCustomer).map((data: any) => ({
      customer: data.customer,
      totalSpent: data.totalSpent,
      transactions: data.transactions,
      orders: data.orders.size,
      averageOrderValue: data.orders.size > 0 ? data.totalSpent / data.orders.size : 0,
      lifetimeValue: data.totalSpent,
    }));

    // Sort by total spent descending
    spending.sort((a, b) => b.totalSpent - a.totalSpent);

    return spending;
  }

  async getPlatformFees(filters?: {
    startDate?: Date;
    endDate?: Date;
    sellerId?: string;
  }) {
    const where: any = {
      type: 'FEE',
      status: 'COMPLETED',
    };

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
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

    const totalFees = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Group by seller
    const bySeller: Record<string, any> = {};
    transactions.forEach((tx) => {
      if (!tx.sellerId) return;
      if (!bySeller[tx.sellerId]) {
        bySeller[tx.sellerId] = {
          seller: tx.seller,
          fees: 0,
          transactions: 0,
        };
      }
      bySeller[tx.sellerId].fees += Number(tx.amount);
      bySeller[tx.sellerId].transactions += 1;
    });

    return {
      totalFees,
      totalTransactions: transactions.length,
      bySeller: Object.values(bySeller),
    };
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}

