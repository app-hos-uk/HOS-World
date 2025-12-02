import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  salesByMonth: Array<{ month: string; sales: number }>;
  topProducts: Array<{ id: string; name: string; sales: number }>;
  recentOrders: any[];
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSellerDashboard(sellerId: string, startDate?: Date, endDate?: Date): Promise<DashboardStats> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const whereClause: any = {
      sellerId: seller.id,
      paymentStatus: 'PAID',
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const [orders, products] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
      this.prisma.product.count({
        where: { sellerId: seller.id },
      }),
    ]);

    const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Sales by month (last 6 months)
    const salesByMonth = this.calculateSalesByMonth(orders);

    // Top products
    const topProducts = this.calculateTopProducts(orders);

    // Recent orders (last 10)
    const recentOrders = orders
      .slice(0, 10)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        status: order.status,
        createdAt: order.createdAt,
      }));

    return {
      totalSales,
      totalOrders,
      totalProducts: products,
      averageOrderValue,
      salesByMonth,
      topProducts,
      recentOrders,
    };
  }

  private calculateSalesByMonth(orders: any[]): Array<{ month: string; sales: number }> {
    const months = new Map<string, number>();

    orders.forEach((order) => {
      const month = order.createdAt.toISOString().slice(0, 7); // YYYY-MM
      const current = months.get(month) || 0;
      months.set(month, current + Number(order.total));
    });

    return Array.from(months.entries())
      .map(([month, sales]) => ({ month, sales }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
  }

  private calculateTopProducts(orders: any[]): Array<{ id: string; name: string; sales: number }> {
    const productSales = new Map<string, { name: string; sales: number }>();

    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        const existing = productSales.get(item.productId) || { name: item.product.name, sales: 0 };
        existing.sales += Number(item.price) * item.quantity;
        productSales.set(item.productId, existing);
      });
    });

    return Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10); // Top 10
  }

  // Wholesaler Dashboard
  async getWholesalerDashboard(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        submissions: {
          include: {
            shipment: true,
            product: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!seller || seller.sellerType !== 'WHOLESALER') {
      throw new NotFoundException('Wholesaler profile not found');
    }

    const submissionsByStatus = await this.prisma.productSubmission.groupBy({
      by: ['status'],
      where: { sellerId: seller.id },
      _count: true,
    });

    const shipmentsInTransit = await this.prisma.shipment.count({
      where: {
        submission: {
          sellerId: seller.id,
        },
        status: { in: ['PENDING', 'IN_TRANSIT'] },
      },
    });

    return {
      submissions: seller.submissions,
      submissionsByStatus,
      shipmentsInTransit,
      totalSubmissions: seller.submissions.length,
    };
  }

  // B2C Seller Dashboard (extends seller dashboard)
  async getB2CSellerDashboard(userId: string) {
    const sellerDashboard = await this.getSellerDashboard(userId);
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const submissionsByStatus = await this.prisma.productSubmission.groupBy({
      by: ['status'],
      where: { sellerId: seller.id },
      _count: true,
    });

    return {
      ...sellerDashboard,
      submissions: seller.submissions,
      submissionsByStatus,
      logisticsOption: seller.logisticsOption,
      customDomain: seller.customDomain,
      subDomain: seller.subDomain,
    };
  }

  // Procurement Dashboard
  async getProcurementDashboard() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            sellerType: true,
          },
        },
        duplicateProducts: {
          take: 5,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const duplicates = await this.prisma.duplicateProduct.findMany({
      where: {
        submission: {
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        },
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                storeName: true,
              },
            },
          },
        },
        existingProduct: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { similarityScore: 'desc' },
      take: 20,
    });

    const stats = await this.prisma.productSubmission.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      pendingSubmissions: submissions,
      duplicateAlerts: duplicates,
      statistics: stats,
      totalPending: submissions.length,
      totalDuplicates: duplicates.length,
    };
  }

  // Fulfillment Dashboard
  async getFulfillmentDashboard() {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        status: { in: ['PENDING', 'IN_TRANSIT', 'RECEIVED'] },
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                storeName: true,
              },
            },
          },
        },
        fulfillmentCenter: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const stats = await this.prisma.shipment.groupBy({
      by: ['status'],
      _count: true,
    });

    const fulfillmentCenters = await this.prisma.fulfillmentCenter.findMany({
      where: { isActive: true },
      include: {
        shipments: {
          where: {
            status: { in: ['PENDING', 'IN_TRANSIT', 'RECEIVED'] },
          },
        },
      },
    });

    return {
      shipments,
      statistics: stats,
      fulfillmentCenters,
      totalPending: shipments.filter((s) => s.status === 'PENDING').length,
      totalInTransit: shipments.filter((s) => s.status === 'IN_TRANSIT').length,
      totalReceived: shipments.filter((s) => s.status === 'RECEIVED').length,
    };
  }

  // Catalog Dashboard
  async getCatalogDashboard() {
    const pending = await this.prisma.productSubmission.findMany({
      where: {
        status: 'FC_ACCEPTED',
        catalogEntry: null,
      },
      include: {
        seller: {
          select: {
            storeName: true,
          },
        },
        shipment: {
          select: {
            receivedAt: true,
          },
        },
      },
      orderBy: { fcAcceptedAt: 'asc' },
      take: 50,
    });

    const inProgress = await this.prisma.catalogEntry.findMany({
      where: {
        submission: {
          status: 'CATALOG_PENDING',
        },
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                storeName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      pendingEntries: pending,
      inProgress: inProgress,
      totalPending: pending.length,
      totalInProgress: inProgress.length,
    };
  }

  // Marketing Dashboard
  async getMarketingDashboard() {
    const pending = await this.prisma.productSubmission.findMany({
      where: {
        status: 'CATALOG_COMPLETED',
      },
      include: {
        seller: {
          select: {
            storeName: true,
          },
        },
        catalogEntry: {
          select: {
            title: true,
            images: true,
          },
        },
        marketingMaterials: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { catalogCompletedAt: 'asc' },
      take: 50,
    });

    const materials = await this.prisma.marketingMaterial.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        submission: {
          include: {
            seller: {
              select: {
                storeName: true,
              },
            },
          },
        },
      },
    });

    return {
      pendingProducts: pending,
      materialsLibrary: materials,
      totalPending: pending.length,
      totalMaterials: materials.length,
    };
  }

  // Finance Dashboard
  async getFinanceDashboard() {
    const pending = await this.prisma.productSubmission.findMany({
      where: {
        status: 'MARKETING_COMPLETED',
      },
      include: {
        seller: {
          select: {
            storeName: true,
            sellerType: true,
          },
        },
        catalogEntry: {
          select: {
            title: true,
          },
        },
        marketingMaterials: {
          take: 3,
        },
      },
      orderBy: { marketingCompletedAt: 'asc' },
      take: 50,
    });

    const pricingHistory = await this.prisma.productPricing.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        product: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      pendingApprovals: pending,
      pricingHistory,
      totalPending: pending.length,
    };
  }

  // Admin Dashboard
  async getAdminDashboard() {
    const [
      totalProducts,
      totalOrders,
      totalSubmissions,
      totalSellers,
      totalCustomers,
      submissionsByStatus,
      ordersByStatus,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.productSubmission.count(),
      this.prisma.seller.count(),
      this.prisma.customer.count(),
      this.prisma.productSubmission.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const recentActivity = await this.prisma.productSubmission.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        seller: {
          select: {
            storeName: true,
          },
        },
      },
    });

    return {
      statistics: {
        totalProducts,
        totalOrders,
        totalSubmissions,
        totalSellers,
        totalCustomers,
      },
      submissionsByStatus,
      ordersByStatus,
      recentActivity,
    };
  }
}


