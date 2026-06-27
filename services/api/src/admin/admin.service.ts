import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { BCRYPT_PASSWORD_ROUNDS } from '../config/bcrypt-cost';
import { isProtectedAdminEmail, isSuperAdminEmail } from '../config/protected-admin-emails';
import { randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';
import { DEFAULT_PLATFORM_FEE_RATE } from '../common/platform-config';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async getUserStats() {
    const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
    const teamRoles = ['PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR'];

    const notDeleted = { deletedAt: null } as const;

    const [total, byRole, inactive, newThisMonth] = await Promise.all([
      this.prisma.user.count({ where: notDeleted }),
      this.prisma.user.groupBy({ by: ['role'], where: notDeleted, _count: true }),
      this.prisma.user.count({ where: { ...notDeleted, isActive: false } }),
      this.prisma.user.count({
        where: {
          ...notDeleted,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    const roleMap: Record<string, number> = {};
    for (const r of byRole) roleMap[r.role] = r._count;

    return {
      total,
      admins: roleMap['ADMIN'] ?? 0,
      sellers: sellerRoles.reduce((s, r) => s + (roleMap[r] ?? 0), 0),
      customers: roleMap['CUSTOMER'] ?? 0,
      influencers: roleMap['INFLUENCER'] ?? 0,
      teamMembers: teamRoles.reduce((s, r) => s + (roleMap[r] ?? 0), 0),
      newThisMonth,
      active: total - inactive,
      inactive,
    };
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    role: UserRole;
    // Admin specific
    permissionRoleName?: string;
    // Seller/Wholesaler specific
    storeName?: string;
    companyName?: string;
    vatNumber?: string;
    // Wholesaler specific
    businessType?: string;
    // Team member specific
    department?: string;
    employeeId?: string;
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

    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_PASSWORD_ROUNDS);

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

    // Check if this is a team role
    const teamRoles: UserRole[] = [
      UserRole.PROCUREMENT,
      UserRole.FULFILLMENT,
      UserRole.CATALOG,
      UserRole.MARKETING,
      UserRole.FINANCE,
      UserRole.CMS_EDITOR,
    ];
    const isTeamRole = teamRoles.includes(data.role);

    // Create user with role-specific fields
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        permissionRoleId,
        // Team member specific fields
        ...(isTeamRole && {
          department: data.department,
          employeeId: data.employeeId,
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        permissionRoleId: true,
        department: true,
        employeeId: true,
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

    // Create wholesaler customer profile with business fields
    if (data.role === UserRole.WHOLESALER) {
      await this.prisma.customer.create({
        data: {
          userId: user.id,
          companyName: data.companyName,
          vatNumber: data.vatNumber,
          businessType: data.businessType,
        },
      });
    }

    if (isSellerRole) {
      const storeName = data.storeName!;
      const baseSlug = storeName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
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
          // Business fields
          companyName: data.companyName,
          vatNumber: data.vatNumber,
        },
      });
    }

    // Create influencer profile + storefront when role is INFLUENCER
    if (data.role === UserRole.INFLUENCER) {
      const displayName =
        [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email.split('@')[0];
      const referralCode = await this.generateUniqueReferralCode(displayName);
      const slug = await this.generateUniqueInfluencerSlug(displayName);
      const influencer = await this.prisma.influencer.create({
        data: {
          userId: user.id,
          displayName,
          slug,
          referralCode,
          status: 'ACTIVE',
        },
      });
      await this.prisma.influencerStorefront.create({
        data: { influencerId: influencer.id },
      });
    }

    return user;
  }

  private async generateUniqueReferralCode(prefix: string): Promise<string> {
    const base =
      prefix
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'INF';
    let attempts = 0;
    while (attempts < 15) {
      const suffix =
        attempts < 10
          ? Math.floor(Math.random() * 100)
              .toString()
              .padStart(2, '0')
          : randomBytes(2).toString('hex').toUpperCase();
      const code = base + suffix;
      const existing = await this.prisma.influencer.findUnique({
        where: { referralCode: code },
      });
      if (!existing) return code;
      attempts++;
    }
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private async generateUniqueInfluencerSlug(displayName: string): Promise<string> {
    const slug =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'influencer';
    let attempts = 0;
    while (attempts < 15) {
      const candidate = attempts === 0 ? slug : `${slug}-${attempts}`;
      const existing = await this.prisma.influencer.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      attempts++;
    }
    return `${slug}-${randomBytes(3).toString('hex')}`;
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
      PROCUREMENT: [
        'submissions.review',
        'submissions.approve',
        'submissions.reject',
        'products.view',
      ],
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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        permissionRoleId: true,
        department: true,
        employeeId: true,
        country: true,
        currencyPreference: true,
        sellerProfile: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            country: true,
            city: true,
            verified: true,
            vendorStatus: true,
            sellerType: true,
            commissionRate: true,
            totalSales: true,
            createdAt: true,
          },
        },
        customerProfile: {
          select: {
            id: true,
            companyName: true,
            vatNumber: true,
            businessType: true,
            country: true,
            currencyPreference: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
      avatar?: string;
      isActive?: boolean;
    },
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Protect hard-protected admin accounts from role/email/status changes.
    if (isProtectedAdminEmail(user.email)) {
      if (updateData.role && updateData.role !== 'ADMIN') {
        throw new BadRequestException('Cannot change role of a protected admin user');
      }
      if (updateData.email && updateData.email !== user.email) {
        throw new BadRequestException('Cannot change email of a protected admin user');
      }
      if (updateData.isActive === false) {
        throw new BadRequestException('Cannot deactivate a protected admin user');
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
          `Invalid role: ${updatePayload.role}. Valid roles are: ${validRoles.join(', ')}`,
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
        isActive: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Protect hard-protected admin accounts from being deactivated
    if (isProtectedAdminEmail(user.email)) {
      throw new BadRequestException('Cannot deactivate a protected admin user');
    }

    const newStatus = !user.isActive;

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
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
    if (isProtectedAdminEmail(user.email)) {
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

  async resetUserPassword(userId: string, newPassword: string, requesterEmail?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requesterIsSuper = isSuperAdminEmail(requesterEmail);

    if (isProtectedAdminEmail(user.email) && !requesterIsSuper) {
      throw new BadRequestException(
        'Cannot reset password for a protected admin user via admin panel',
      );
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_PASSWORD_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(
      `Password reset for user ${user.email} (${userId}) by ${requesterEmail || 'unknown'}`,
    );

    return { message: 'Password reset successfully' };
  }

  // ---------------------------------------------------------------------------
  // Platform Config helpers (uses the `configs` table with level=PLATFORM)
  // ---------------------------------------------------------------------------

  private async getPlatformConfig(key: string): Promise<any | undefined> {
    const row = await this.prisma.config.findFirst({
      where: { level: 'PLATFORM', levelId: 'PLATFORM', key },
    });
    return row?.value;
  }

  private async setPlatformConfig(key: string, value: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.config.findFirst({
        where: { level: 'PLATFORM', levelId: 'PLATFORM', key },
        select: { id: true },
      });

      if (existing) {
        await tx.config.update({
          where: { id: existing.id },
          data: { value },
        });
      } else {
        await tx.config.create({
          data: { level: 'PLATFORM', levelId: 'PLATFORM', key, value },
        });
      }
    });
  }

  /**
   * Returns whether the e-commerce shop is enabled.
   * Reads from the DB first; falls back to the env var.
   */
  async isShopEnabled(): Promise<boolean> {
    try {
      const dbVal = await this.getPlatformConfig('shopEnabled');
      if (dbVal !== undefined) {
        return dbVal === true || dbVal === 'true';
      }
    } catch {
      // DB unavailable — fall through to env var
    }
    return process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';
  }

  async getSystemSettings() {
    const envDefaults = {
      platformName: process.env.PLATFORM_NAME || 'House of Spells Marketplace',
      platformUrl: process.env.PLATFORM_URL || process.env.FRONTEND_URL || '',
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
      requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
      platformFeeRate: parseFloat(process.env.PLATFORM_FEE_RATE || String(DEFAULT_PLATFORM_FEE_RATE)),
      currency: process.env.DEFAULT_CURRENCY || 'USD',
      maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10),
      enableOAuth: process.env.ENABLE_OAUTH !== 'false',
      enableStripe: process.env.STRIPE_SECRET_KEY ? true : false,
      shopEnabled: process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true',
      contactEmail:
        process.env.CONTACT_EMAIL ||
        process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
        'info@houseofspells.com',
      contactPhone:
        process.env.CONTACT_PHONE || process.env.NEXT_PUBLIC_FOOTER_PHONE || '+1 (212) 555-0100',
      contactAddress:
        process.env.CONTACT_ADDRESS ||
        process.env.NEXT_PUBLIC_CONTACT_ADDRESS ||
        '123 Broadway, New York, NY 10007',
      footerAbout:
        process.env.FOOTER_ABOUT ||
        'An immersive fandom experience — franchises, collectibles, and unforgettable finds online and in our stores.',
      socialFacebookUrl: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL || '',
      socialInstagramUrl: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL || '',
      socialXUrl:
        process.env.NEXT_PUBLIC_SOCIAL_X_URL || process.env.NEXT_PUBLIC_SOCIAL_TWITTER_URL || '',
    };

    try {
      const rows = await this.prisma.config.findMany({
        where: { level: 'PLATFORM', levelId: 'PLATFORM' },
      });

      const dbOverrides: Record<string, any> = {};
      for (const row of rows) {
        dbOverrides[row.key] = row.value;
      }

      return { ...envDefaults, ...dbOverrides };
    } catch {
      return envDefaults;
    }
  }

  async getPublicSiteSettings() {
    const settings = await this.getSystemSettings();
    return {
      platformName: settings.platformName,
      platformUrl: settings.platformUrl,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      contactAddress: settings.contactAddress,
      footerAbout: settings.footerAbout,
      socialFacebookUrl: settings.socialFacebookUrl,
      socialInstagramUrl: settings.socialInstagramUrl,
      socialXUrl: settings.socialXUrl,
    };
  }

  async updateSystemSettings(settings: any) {
    try {
      const allowed: Record<string, (v: any) => any> = {
        platformName: (v) => String(v),
        platformUrl: (v) => String(v),
        maintenanceMode: (v) => Boolean(v),
        allowRegistration: (v) => Boolean(v),
        requireEmailVerification: (v) => Boolean(v),
        shopEnabled: (v) => Boolean(v),
        platformFeeRate: (v) => {
          const r = parseFloat(v);
          return r >= 0 && r <= 1 ? r : undefined;
        },
        currency: (v) => String(v).toUpperCase(),
        maxUploadSize: (v) => parseInt(v, 10),
        contactEmail: (v) => String(v).trim(),
        contactPhone: (v) => String(v).trim(),
        contactAddress: (v) => String(v).trim(),
        footerAbout: (v) => String(v).trim(),
        socialFacebookUrl: (v) => String(v).trim(),
        socialInstagramUrl: (v) => String(v).trim(),
        socialXUrl: (v) => String(v).trim(),
      };

      const validSettings: Record<string, any> = {};

      for (const [key, sanitize] of Object.entries(allowed)) {
        if (settings[key] !== undefined) {
          const cleaned = sanitize(settings[key]);
          if (cleaned !== undefined) {
            validSettings[key] = cleaned;
          }
        }
      }

      // Persist each setting to the Config table
      for (const [key, value] of Object.entries(validSettings)) {
        await this.setPlatformConfig(key, value);
      }

      // Audit trail
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
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`Failed to update system settings: ${msg}`);
      throw new BadRequestException('Failed to update system settings. Please try again.');
    }
  }

  // Duplicate methods removed - using Prisma-based implementations above (lines 252-294)

  async getAllSellers(options?: { page?: number; limit?: number }): Promise<{
    data: Array<Record<string, unknown>>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const take = Math.max(1, Math.min(options?.limit ?? 50, 100));
    const page = Math.max(1, options?.page ?? 1);
    const skip = (page - 1) * take;

    const [sellers, total] = await Promise.all([
      this.prisma.seller.findMany({
        take,
        skip,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
              avatar: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.seller.count(),
    ]);

    const addressIds = [
      ...new Set(
        sellers.map((s) => s.warehouseAddressId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const addressRows = addressIds.length
      ? await this.prisma.address.findMany({
          where: { id: { in: addressIds } },
          select: {
            id: true,
            street: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            phone: true,
          },
        })
      : [];
    const byAddressId = new Map(addressRows.map((a) => [a.id, a]));

    const sellersWithAddresses = sellers.map((seller) => {
      const warehouseAddress = seller.warehouseAddressId
        ? byAddressId.get(seller.warehouseAddressId) ?? null
        : null;
      return {
        ...seller,
        warehouseAddress,
        totalProducts: seller._count?.products || 0,
      };
    });

    const stripped = sellersWithAddresses.map(
      ({ accountNumberEnc, sortCodeEnc, stripeConnectAccountId, ...rest }) => rest,
    );

    return {
      data: stripped,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async suspendSeller(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { user: true },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Protect admin accounts
    if (isProtectedAdminEmail(seller.user.email)) {
      throw new BadRequestException('Cannot suspend a protected admin user');
    }

    // Toggle seller verified status (Seller model uses 'verified' field, not 'isActive')
    const newStatus = seller.verified === false ? true : false;

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { verified: newStatus },
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
    });

    return {
      ...updated,
      message: newStatus ? 'Seller activated successfully' : 'Seller suspended successfully',
    };
  }

  async getDashboardStats() {
    const [
      totalProducts,
      totalOrders,
      totalSubmissions,
      totalSellers,
      totalCustomers,
      totalUsers,
      submissionsByStatus,
      ordersByStatus,
      pendingReviews,
      totalReviews,
      pendingNotifications,
      failedNotifications,
      recentActivityLogs,
      openDiscrepancies,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.productSubmission.count(),
      this.prisma.user.count({ where: { role: { in: ['SELLER', 'B2C_SELLER', 'WHOLESALER'] } } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count(),
      this.prisma.productSubmission.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.productReview.count({ where: { status: 'PENDING' } }),
      this.prisma.productReview.count(),
      this.prisma.notification.count({ where: { status: 'PENDING' as any } }),
      this.prisma.notification.count({ where: { status: 'FAILED' as any } }),
      this.prisma.activityLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        where: {
          action: { notIn: ['SYSTEM_HEALTH_CHECK', 'DISCREPANCY_SCAN_COMPLETED'] },
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.discrepancy.count({ where: { status: 'OPEN' } }),
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
        totalUsers,
        pendingReviews,
        totalReviews,
        openDiscrepancies,
      },
      notifications: {
        pending: pendingNotifications,
        failed: failedNotifications,
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
      recentActivityLogs,
    };
  }
}
