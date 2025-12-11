import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        sellerProfile: {
          select: {
            storeName: true,
            verified: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerProfile: true,
        customerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(userId: string, updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    avatar?: string;
  }) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Protect the main admin user from role changes
    if (user.email === 'app@houseofspells.co.uk') {
      if (updateData.role && updateData.role !== 'ADMIN') {
        throw new BadRequestException('Cannot change role of the primary admin user');
      }
      if (updateData.email && updateData.email !== 'app@houseofspells.co.uk') {
        throw new BadRequestException('Cannot change email of the primary admin user');
      }
    }

    // Check if email is being changed and if it's already taken
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData as any,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(userId: string) {
    // Prevent deleting admin users
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Protect the main admin user from deletion
    if (user.email === 'app@houseofspells.co.uk') {
      throw new BadRequestException('Cannot delete the primary admin user');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot delete admin users');
    }

    // Delete user (cascade will handle related records)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  async resetUserPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password reset successfully' };
  }

  async getSystemSettings() {
    // TODO: Implement system settings storage (could use a Settings model or environment variables)
    return {
      platformName: process.env.PLATFORM_NAME || 'House of Spells Marketplace',
      platformUrl: process.env.PLATFORM_URL || '',
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
      requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    };
  }

  async updateSystemSettings(settings: any) {
    // TODO: Implement system settings update (could use a Settings model)
    // For now, this is a placeholder
    return { message: 'Settings updated successfully', settings };
  }

  async getRolePermissions(role: string) {
    // TODO: Implement permissions storage (could use a Permissions model)
    // For now, return default permissions based on role
    const defaultPermissions: Record<string, string[]> = {
      ADMIN: ['*'], // All permissions
      PROCUREMENT: ['submissions.review', 'submissions.approve', 'submissions.reject'],
      FULFILLMENT: ['shipments.verify', 'orders.view', 'orders.manage'],
      CATALOG: ['catalog.create', 'products.view', 'products.edit'],
      MARKETING: ['marketing.create', 'products.view'],
      FINANCE: ['pricing.approve', 'orders.view', 'orders.refund'],
      SELLER: ['products.create', 'products.edit', 'orders.view', 'orders.manage'],
      B2C_SELLER: ['products.create', 'products.edit', 'orders.view', 'orders.manage'],
      WHOLESALER: ['products.create', 'products.edit', 'orders.view'],
      CUSTOMER: ['products.view', 'orders.view'],
      CMS_EDITOR: ['products.view', 'products.edit', 'catalog.create'],
    };

    return defaultPermissions[role] || [];
  }

  async updateRolePermissions(role: string, permissions: string[]) {
    // TODO: Implement permissions update (could use a RolePermissions model)
    return { message: 'Permissions updated successfully', role, permissions };
  }

  async getAllSellers() {
    const sellers = await this.prisma.seller.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sellers;
  }

  async getDashboardStats() {
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
      this.prisma.user.count({ where: { role: { in: ['SELLER', 'B2C_SELLER', 'WHOLESALER'] } } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
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
      take: 10,
      orderBy: { createdAt: 'desc' },
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
      submissionsByStatus: submissionsByStatus.map((s) => ({
        status: s.status,
        _count: s._count,
      })),
      ordersByStatus: ordersByStatus.map((o) => ({
        status: o.status,
        _count: o._count,
      })),
      recentActivity,
    };
  }
}

