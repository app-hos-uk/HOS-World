import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  userId?: string;
  userRole?: string;
}

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private context: TenantContext | null = null;

  constructor(
    @Inject(REQUEST) private request: any,
    private prisma: PrismaService,
  ) {}

  async resolveContext(): Promise<TenantContext> {
    if (this.context) {
      return this.context;
    }

    // Resolve from request headers
    const domain = this.request.headers['x-tenant-domain'];
    const subdomain = this.request.headers['x-tenant-subdomain'];
    const tenantId = this.request.headers['x-tenant-id'];

    // Resolve from request body (for POST requests)
    const bodyTenantId = this.request.body?.tenantId;

    // Resolve from query params
    const queryTenantId = this.request.query?.tenantId;

    // Priority: header > body > query
    const resolvedTenantId = tenantId || bodyTenantId || queryTenantId;

    if (resolvedTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
      });
      if (tenant && tenant.isActive) {
        this.context = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          userId: this.request.user?.id,
          userRole: this.request.user?.role,
        };
        return this.context;
      }
    }

    // Try domain resolution
    if (domain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { domain },
      });
      if (tenant && tenant.isActive) {
        this.context = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          userId: this.request.user?.id,
          userRole: this.request.user?.role,
        };
        return this.context;
      }
    }

    // Try subdomain resolution
    if (subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
      });
      if (tenant && tenant.isActive) {
        this.context = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          userId: this.request.user?.id,
          userRole: this.request.user?.role,
        };
        return this.context;
      }
    }

    // Resolve from user's default tenant or first tenant membership
    if (this.request.user?.id) {
      let user;

      if (this.request.user.defaultTenantId) {
        user = await this.prisma.user.findUnique({
          where: { id: this.request.user.id },
          include: {
            tenantMemberships: {
              where: {
                isActive: true,
                tenantId: this.request.user.defaultTenantId,
              },
              include: {
                tenant: true,
              },
              take: 1,
            },
          },
        });
      } else {
        user = await this.prisma.user.findUnique({
          where: { id: this.request.user.id },
          include: {
            tenantMemberships: {
              where: { isActive: true },
              include: {
                tenant: true,
              },
              orderBy: { joinedAt: 'asc' },
              take: 1,
            },
          },
        });
      }

      if (user?.tenantMemberships && user.tenantMemberships.length > 0) {
        const membership = user.tenantMemberships[0];
        this.context = {
          tenantId: membership.tenant.id,
          tenantName: membership.tenant.name,
          userId: user.id,
          userRole: membership.role,
        };
        return this.context;
      }
    }

    // Default to platform tenant (create if doesn't exist)
    let platformTenant = await this.prisma.tenant.findUnique({
      where: { id: 'platform' },
    });

    if (!platformTenant) {
      platformTenant = await this.prisma.tenant.create({
        data: {
          id: 'platform',
          name: 'Platform',
          subdomain: 'platform',
          isActive: true,
        },
      });
    }

    this.context = {
      tenantId: platformTenant.id,
      tenantName: platformTenant.name,
      userId: this.request.user?.id,
      userRole: this.request.user?.role,
    };

    return this.context;
  }

  getContext(): TenantContext | null {
    return this.context;
  }

  setContext(context: TenantContext): void {
    this.context = context;
  }
}
