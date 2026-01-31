import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  sellerId?: string;
  customerId?: string;
  warehouseId?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  compareWithPrevious?: boolean;
}

export interface SalesTrend {
  period: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  growth?: number; // Percentage growth vs previous period
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number; // Percentage
  averageLTV: number; // Lifetime value
  averageOrderFrequency: number;
  churnRate: number; // Percentage
}

export interface ProductPerformance {
  productId: string;
  name: string;
  sku: string;
  revenue: number;
  orders: number;
  quantity: number;
  averagePrice: number;
  conversionRate?: number;
}

export interface InventoryMetrics {
  totalValue: number;
  totalQuantity: number;
  warehouseCount: number;
  lowStockItems: number;
  turnoverRate: number; // Annual turnover
  averageDaysInStock: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get sales trends with growth calculations
   */
  async getSalesTrends(filters: AnalyticsFilters): Promise<{
    trends: SalesTrend[];
    totalRevenue: number;
    totalOrders: number;
    growthRate: number;
    periodComparison?: {
      current: { revenue: number; orders: number };
      previous: { revenue: number; orders: number };
      growth: { revenue: number; orders: number };
    };
  }> {
    const { startDate, endDate, period = 'monthly', compareWithPrevious } = filters;

    // Calculate date range
    const currentStart = startDate || this.getStartOfPeriod(new Date(), period);
    const currentEnd = endDate || new Date();

    // Get current period data
    const currentOrders = await this.getOrdersInRange(currentStart, currentEnd, filters);

    // Group by period
    const trends = this.groupOrdersByPeriod(currentOrders, period);

    // Calculate growth rates
    if (trends.length > 1) {
      for (let i = 1; i < trends.length; i++) {
        const current = trends[i];
        const previous = trends[i - 1];
        if (previous.revenue > 0) {
          current.growth = ((current.revenue - previous.revenue) / previous.revenue) * 100;
        }
      }
    }

    const totalRevenue = currentOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = currentOrders.length;

    let periodComparison;
    if (compareWithPrevious) {
      const previousPeriodData = await this.getPreviousPeriodData(
        currentStart,
        currentEnd,
        period,
        filters,
      );
      const previousRevenue = previousPeriodData.reduce((sum, o) => sum + Number(o.total), 0);
      const previousOrders = previousPeriodData.length;

      periodComparison = {
        current: { revenue: totalRevenue, orders: totalOrders },
        previous: { revenue: previousRevenue, orders: previousOrders },
        growth: {
          revenue:
            previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0,
          orders: previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0,
        },
      };
    }

    const growthRate =
      trends.length >= 2 && trends[trends.length - 2].revenue > 0
        ? ((trends[trends.length - 1].revenue - trends[trends.length - 2].revenue) /
            trends[trends.length - 2].revenue) *
          100
        : 0;

    return {
      trends,
      totalRevenue,
      totalOrders,
      growthRate,
      periodComparison,
    };
  }

  /**
   * Get customer analytics including retention and LTV
   */
  async getCustomerMetrics(filters: AnalyticsFilters): Promise<CustomerMetrics> {
    const { startDate, endDate } = filters;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    // Get all customers
    const allCustomers = await this.prisma.customer.findMany({
      where: dateFilter,
      include: {
        user: true,
      },
    });

    // Get customers with orders
    const customersWithOrders = await this.prisma.order.findMany({
      where: {
        ...dateFilter,
        paymentStatus: 'PAID',
      },
      select: {
        userId: true,
        total: true,
        createdAt: true,
      },
    });

    // Calculate metrics
    const totalCustomers = allCustomers.length;
    const newCustomers = allCustomers.filter((c) => {
      if (!startDate) return true;
      const createdAt = c.user?.createdAt;
      return createdAt && new Date(createdAt) >= startDate;
    }).length;

    // Group orders by customer
    const customerOrderMap = new Map<
      string,
      { total: number; orders: number; firstOrder: Date; lastOrder: Date }
    >();
    customersWithOrders.forEach((order) => {
      if (!order.userId) return;
      const existing = customerOrderMap.get(order.userId) || {
        total: 0,
        orders: 0,
        firstOrder: new Date(order.createdAt),
        lastOrder: new Date(order.createdAt),
      };
      existing.total += Number(order.total);
      existing.orders += 1;
      if (new Date(order.createdAt) < existing.firstOrder) {
        existing.firstOrder = new Date(order.createdAt);
      }
      if (new Date(order.createdAt) > existing.lastOrder) {
        existing.lastOrder = new Date(order.createdAt);
      }
      customerOrderMap.set(order.userId, existing);
    });

    const returningCustomers = Array.from(customerOrderMap.values()).filter(
      (c) => c.orders > 1,
    ).length;

    // Calculate retention rate (customers with 2+ orders / total customers with orders)
    const customersWithAnyOrders = customerOrderMap.size;
    const retentionRate =
      customersWithAnyOrders > 0 ? (returningCustomers / customersWithAnyOrders) * 100 : 0;

    // Calculate average LTV
    const ltvValues = Array.from(customerOrderMap.values()).map((c) => c.total);
    const averageLTV =
      ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;

    // Calculate average order frequency (orders per customer)
    const totalOrdersCount = customersWithOrders.length;
    const averageOrderFrequency =
      customersWithAnyOrders > 0 ? totalOrdersCount / customersWithAnyOrders : 0;

    // Calculate churn rate (simplified: customers with no orders in last 30 days / total customers)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = customersWithOrders.filter((o) => new Date(o.createdAt) >= thirtyDaysAgo);
    const recentCustomerIds = new Set(recentOrders.map((o) => o.userId).filter(Boolean));
    const churnedCustomers = Array.from(customerOrderMap.keys()).filter(
      (id) => !recentCustomerIds.has(id),
    ).length;
    const churnRate =
      customersWithAnyOrders > 0 ? (churnedCustomers / customersWithAnyOrders) * 100 : 0;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      retentionRate: Math.round(retentionRate * 100) / 100,
      averageLTV: Math.round(averageLTV * 100) / 100,
      averageOrderFrequency: Math.round(averageOrderFrequency * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
    };
  }

  /**
   * Get product performance metrics
   */
  async getProductPerformance(
    filters: AnalyticsFilters,
    limit: number = 20,
  ): Promise<ProductPerformance[]> {
    const { startDate, endDate, sellerId } = filters;

    const orderWhere: any = {
      paymentStatus: 'PAID',
    };

    if (startDate || endDate) {
      orderWhere.createdAt = {};
      if (startDate) orderWhere.createdAt.gte = startDate;
      if (endDate) orderWhere.createdAt.lte = endDate;
    }

    if (sellerId) {
      orderWhere.sellerId = sellerId;
    }

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by product
    const productMap = new Map<string, ProductPerformance>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const product = item.product;
        const existing = productMap.get(product.id) || {
          productId: product.id,
          name: product.name,
          sku: product.sku || '',
          revenue: 0,
          orders: 0,
          quantity: 0,
          averagePrice: Number(product.price),
        };

        existing.revenue += Number(item.price) * item.quantity;
        existing.quantity += item.quantity;
        existing.orders += 1;
        productMap.set(product.id, existing);
      });
    });

    const performance = Array.from(productMap.values())
      .map((p) => ({
        ...p,
        averagePrice: p.quantity > 0 ? p.revenue / p.quantity : p.averagePrice,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return performance;
  }

  /**
   * Get inventory metrics and turnover
   */
  async getInventoryMetrics(filters: AnalyticsFilters): Promise<InventoryMetrics> {
    const { warehouseId } = filters;

    // Get inventory locations
    const where: any = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const locations = await this.prisma.inventoryLocation.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            price: true,
          },
        },
      },
    });

    // Calculate metrics
    let totalValue = 0;
    let totalQuantity = 0;
    let lowStockCount = 0;
    const warehouses = new Set<string>();

    locations.forEach((loc) => {
      const value = Number(loc.product.price) * loc.quantity;
      totalValue += value;
      totalQuantity += loc.quantity;
      if (loc.quantity <= (loc.lowStockThreshold || 10)) {
        lowStockCount++;
      }
      warehouses.add(loc.warehouseId);
    });

    // Calculate turnover rate (simplified: sales / average inventory)
    const { startDate, endDate } = filters;
    const dateFilter: any = { paymentStatus: 'PAID' };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    const periodDays =
      startDate && endDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : 365;

    const orders = await this.prisma.order.findMany({
      where: dateFilter,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    let totalSales = 0;
    orders.forEach((order) => {
      order.items.forEach((item) => {
        totalSales += Number(item.price) * item.quantity;
      });
    });

    const averageInventory = totalValue;
    const turnoverRate =
      averageInventory > 0 ? (totalSales / averageInventory) * (365 / periodDays) : 0;

    // Calculate average days in stock (simplified)
    const averageDaysInStock = turnoverRate > 0 ? 365 / turnoverRate : 365;

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalQuantity,
      warehouseCount: warehouses.size,
      lowStockItems: lowStockCount,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      averageDaysInStock: Math.round(averageDaysInStock * 100) / 100,
    };
  }

  /**
   * Get revenue growth rate (MoM, YoY)
   */
  async getRevenueGrowth(
    currentStart: Date,
    currentEnd: Date,
    comparisonType: 'month' | 'year',
  ): Promise<{ current: number; previous: number; growth: number }> {
    const currentOrders = await this.getOrdersInRange(currentStart, currentEnd);
    const currentRevenue = currentOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Calculate previous period
    const previousEnd = new Date(currentStart);
    previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
    const previousStart = new Date(previousEnd);
    if (comparisonType === 'month') {
      previousStart.setMonth(previousStart.getMonth() - 1);
    } else {
      previousStart.setFullYear(previousStart.getFullYear() - 1);
    }

    const previousOrders = await this.getOrdersInRange(previousStart, previousEnd);
    const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.total), 0);

    const growth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      current: currentRevenue,
      previous: previousRevenue,
      growth: Math.round(growth * 100) / 100,
    };
  }

  // Helper methods

  private async getOrdersInRange(
    startDate: Date,
    endDate: Date,
    filters?: AnalyticsFilters,
  ): Promise<any[]> {
    const where: any = {
      paymentStatus: 'PAID',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  private async getPreviousPeriodData(
    currentStart: Date,
    currentEnd: Date,
    period: string,
    filters?: AnalyticsFilters,
  ): Promise<any[]> {
    const duration = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart);
    previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);

    return this.getOrdersInRange(previousStart, previousEnd, filters);
  }

  private groupOrdersByPeriod(orders: any[], period: string): SalesTrend[] {
    const grouped = new Map<string, { revenue: number; orders: number; orderCount: number }>();

    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      let key: string;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          key = `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = String(date.getFullYear());
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = grouped.get(key) || { revenue: 0, orders: 0, orderCount: 0 };
      existing.revenue += Number(order.total);
      existing.orderCount += 1;
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries())
      .map(([period, data]) => ({
        period,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orderCount,
        averageOrderValue:
          data.orderCount > 0 ? Math.round((data.revenue / data.orderCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  private getStartOfPeriod(date: Date, period: string): Date {
    const start = new Date(date);
    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const day = start.getDay();
        start.setDate(start.getDate() - day);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    return start;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
