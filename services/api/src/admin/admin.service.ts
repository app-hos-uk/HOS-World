import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Hard-protected admin accounts that must never be modified/deleted by other users.
  // These are emergency/owner accounts for platform recovery.
  private readonly protectedAdminEmails = new Set([
    'app@houseofspells.co.uk',
    'mail@jsabu.com',
  ]);

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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    storeName?: string;
    permissionRoleName?: string;
  }) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    // Basic guardrails for role-specific requirements
    const sellerRoles: UserRole[] = [UserRole.SELLER, UserRole.B2C_SELLER, UserRole.WHOLESALER];
    const isSellerRole = sellerRoles.includes(data.role);
    if (isSellerRole && !data.storeName) {
      throw new BadRequestException('storeName is required for seller roles');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let permissionRoleId: string | undefined;
    if (data.permissionRoleName) {
      const roleName = data.permissionRoleName.trim().toUpperCase();
      const pr = await this.prisma.permissionRole.findUnique({
        where: { name: roleName },
        select: { id: true },
      });
      if (!pr) {
        throw new BadRequestException('Permission role not found');
      }
      permissionRoleId = pr.id;
    }

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        permissionRoleId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissionRoleId: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create role-specific profiles if needed
    if (data.role === UserRole.CUSTOMER) {
      await this.prisma.customer.create({
        data: { userId: user.id },
      });
    }

    if (isSellerRole) {
      const storeName = data.storeName!;
      const baseSlug = storeName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      // If baseSlug is empty after sanitization, use a fallback prefix
      const slugPrefix = baseSlug || `seller-${user.id.slice(0, 8)}`;
      let slug = slugPrefix;
      let counter = 1;
      while (await this.prisma.seller.findUnique({ where: { slug } })) {
        // Always use slugPrefix (never empty) to avoid invalid slugs like "-1", "-2"
        slug = `${slugPrefix}-${counter}`;
        counter++;
      }

      await this.prisma.seller.create({
        data: {
          userId: user.id,
          storeName,
          slug,
          country: 'US',
          timezone: 'UTC',
          sellerType: data.role === UserRole.WHOLESALER ? 'WHOLESALER' : 'B2C_SELLER',
          logisticsOption: 'HOS_LOGISTICS',
        },
      });
    }

    return user;
  }

  // ---- Permission Roles (custom roles) ----
  // Canonical permission ids (keep in sync with `apps/web/src/app/admin/permissions/page.tsx`)
  private readonly permissionCatalog = [
    // Products
    'products.create',
    'products.edit',
    'products.delete',
    'products.publish',
    'products.view',
    // Orders
    'orders.view',
    'orders.manage',
    'orders.cancel',
    'orders.refund',
    // Users
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.roles',
    // Business Ops
    'submissions.review',
    'submissions.approve',
    'submissions.reject',
    'shipments.verify',
    'catalog.create',
    'marketing.create',
    'pricing.approve',
    // System
    'system.settings',
    'system.themes',
    'system.permissions',
    'system.analytics',
    // Sellers
    'sellers.view',
    'sellers.approve',
    'sellers.suspend',
  ] as const;

  private readonly builtInRoles = [
    'ADMIN',
    'PROCUREMENT',
    'FULFILLMENT',
    'CATALOG',
    'MARKETING',
    'FINANCE',
    'SELLER',
    'B2C_SELLER',
    'WHOLESALER',
    'CUSTOMER',
    'CMS_EDITOR',
  ] as const;

  private defaultRolePermissions(): Record<string, string[]> {
    const all = [...this.permissionCatalog];
    return {
      ADMIN: all,
      PROCUREMENT: ['submissions.review', 'submissions.approve', 'submissions.reject', 'products.view'],
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
  }

  async listPermissionRoles(): Promise<string[]> {
    // Ensure built-in roles exist as permission roles (seed-on-read).
    const defaults = this.defaultRolePermissions();
    for (const roleName of this.builtInRoles) {
      const perms = defaults[roleName] || [];
      await this.prisma.permissionRole.upsert({
        where: { name: roleName },
        create: {
          name: roleName,
          permissions: perms,
        },
        update: {}, // don't overwrite existing customizations
      });
    }

    const roles = await this.prisma.permissionRole.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => r.name);
  }

  async createPermissionRole(name: string) {
    const roleName = name.trim().toUpperCase().replace(/\s+/g, '_');
    if (!roleName) throw new BadRequestException('Role name is required');

    // Disallow collision with platform roles
    if (this.builtInRoles.includes(roleName as any)) {
      throw new BadRequestException('Role already exists');
    }

    const existing = await this.prisma.permissionRole.findUnique({ where: { name: roleName } });
    if (existing) throw new BadRequestException('Role already exists');

    return this.prisma.permissionRole.create({
      data: {
        name: roleName,
        permissions: [],
      },
      select: { id: true, name: true, permissions: true, createdAt: true, updatedAt: true },
    });
  }

  async getRolePermissions(role: string) {
    const roleName = role.trim().toUpperCase();
    const defaults = this.defaultRolePermissions();

    // If it's a built-in role and doesn't exist yet, create with defaults.
    if (this.builtInRoles.includes(roleName as any)) {
      await this.prisma.permissionRole.upsert({
        where: { name: roleName },
        create: {
          name: roleName,
          permissions: defaults[roleName] || [],
        },
        update: {},
      });
    }

    const found = await this.prisma.permissionRole.findUnique({
      where: { name: roleName },
      select: { permissions: true },
    });

    if (!found) return [];

    return Array.isArray(found.permissions) ? (found.permissions as any[]).map(String) : [];
  }

  async updateRolePermissions(role: string, permissions: string[]) {
    const roleName = role.trim().toUpperCase();
    const cleaned = Array.isArray(permissions) ? permissions.map(String) : [];

    await this.prisma.permissionRole.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        permissions: cleaned,
      },
      update: {
        permissions: cleaned,
      },
    });

    return { message: 'Permissions updated successfully', role: roleName, permissions: cleaned };
  }

  async getPermissionCatalog() {
    return this.permissionCatalog.map((id) => ({ id }));
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

    // Protect hard-protected admin accounts from role/email changes (prevents making them deletable).
    if (this.protectedAdminEmails.has(user.email)) {
      if (updateData.role && updateData.role !== 'ADMIN') {
        throw new BadRequestException('Cannot change role of a protected admin user');
      }
      if (updateData.email && updateData.email !== user.email) {
        throw new BadRequestException('Cannot change email of a protected admin user');
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

    // Convert role string to enum if provided
    const updatePayload: any = { ...updateData };
    if (updatePayload.role) {
      // Validate and convert role string to UserRole enum
      const roleString = updatePayload.role.toUpperCase();
      const validRoles = Object.values(UserRole) as string[];
      if (!validRoles.includes(roleString)) {
        throw new BadRequestException(
          `Invalid role: ${updatePayload.role}. Valid roles are: ${validRoles.join(', ')}`
        );
      }
      updatePayload.role = roleString as UserRole;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updatePayload,
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

    // Protect hard-protected admin accounts from deletion (even if role is changed somehow).
    if (this.protectedAdminEmails.has(user.email)) {
      throw new BadRequestException('Cannot delete a protected admin user');
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

    // Prevent other admins from resetting protected admin passwords via admin panel.
    if (this.protectedAdminEmails.has(user.email)) {
      throw new BadRequestException('Cannot reset password for a protected admin user via admin panel');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password reset successfully' };
  }

  async getSystemSettings() {
    // Try to get settings from database (using a simple key-value approach)
    // If no settings exist, use environment variables as defaults
    try {
      // Check if we have a system settings record (using ActivityLog or a dedicated approach)
      // For now, we'll use environment variables with database override capability
      // In production, you could create a SystemSettings model
      
      const defaultSettings = {
        platformName: process.env.PLATFORM_NAME || 'House of Spells Marketplace',
        platformUrl: process.env.PLATFORM_URL || process.env.FRONTEND_URL || '',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
        allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
        requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
        platformFeeRate: parseFloat(process.env.PLATFORM_FEE_RATE || '0.15'),
        currency: process.env.DEFAULT_CURRENCY || 'GBP',
        maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB default
        enableOAuth: process.env.ENABLE_OAUTH !== 'false',
        enableStripe: process.env.STRIPE_SECRET_KEY ? true : false,
        enableKlarna: process.env.KLARNA_USERNAME ? true : false,
      };
      
      // Try to get custom settings from a metadata field or dedicated storage
      // For now, return defaults. In production, you could:
      // 1. Create a SystemSettings model
      // 2. Use a JSON file
      // 3. Use Redis for settings cache
      
      return defaultSettings;
    } catch (error) {
      // Fallback to environment variables only
      return {
        platformName: process.env.PLATFORM_NAME || 'House of Spells Marketplace',
        platformUrl: process.env.PLATFORM_URL || '',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
        allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
        requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
      };
    }
  }

  async updateSystemSettings(settings: any) {
    // Store settings in a way that persists
    // For now, we'll log the update and return success
    // In production, you should:
    // 1. Create a SystemSettings model and store in database
    // 2. Or use a JSON file with proper locking
    // 3. Or use Redis for settings cache
    
    try {
      // Validate settings
      const validSettings: any = {};
      
      if (settings.platformName !== undefined) {
        validSettings.platformName = String(settings.platformName);
      }
      if (settings.platformUrl !== undefined) {
        validSettings.platformUrl = String(settings.platformUrl);
      }
      if (settings.maintenanceMode !== undefined) {
        validSettings.maintenanceMode = Boolean(settings.maintenanceMode);
      }
      if (settings.allowRegistration !== undefined) {
        validSettings.allowRegistration = Boolean(settings.allowRegistration);
      }
      if (settings.requireEmailVerification !== undefined) {
        validSettings.requireEmailVerification = Boolean(settings.requireEmailVerification);
      }
      if (settings.platformFeeRate !== undefined) {
        const rate = parseFloat(settings.platformFeeRate);
        if (rate >= 0 && rate <= 1) {
          validSettings.platformFeeRate = rate;
        }
      }
      if (settings.currency !== undefined) {
        validSettings.currency = String(settings.currency).toUpperCase();
      }
      if (settings.maxUploadSize !== undefined) {
        validSettings.maxUploadSize = parseInt(settings.maxUploadSize, 10);
      }
      
      // Log the settings update (for audit trail)
      // In production, store in SystemSettings table
      // For now, we'll create an activity log entry
      await this.prisma.activityLog.create({
        data: {
          action: 'SYSTEM_SETTINGS_UPDATED',
          entityType: 'SystemSettings',
          description: `System settings updated: ${JSON.stringify(validSettings)}`,
          metadata: validSettings as any,
        },
      });
      
      return {
        message: 'Settings updated successfully',
        settings: validSettings,
        note: 'Settings are stored in activity log. For production, consider creating a SystemSettings model for persistent storage.',
      };
    } catch (error: any) {
      throw new Error(`Failed to update system settings: ${error?.message}`);
    }
  }

  // Duplicate methods removed - using Prisma-based implementations above (lines 252-294)

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

