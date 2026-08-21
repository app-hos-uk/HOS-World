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

  /**
   * Never trust a client-supplied tenant id without membership.
   * Unauthenticated callers cannot pin tenant via header/body/query.
   * ADMIN platform role may access any active tenant.
   */
  private async canAccessTenant(tenantId: string): Promise<boolean> {
    const user = this.request.user;
    if (!user?.id) {
      return false;
    }
    if (String(user.role).toUpperCase() === 'ADMIN') {
      return true;
    }
    const membership = await this.prisma.tenantUser.findFirst({
      where: { tenantId, userId: user.id, isActive: true },
      select: { id: true },
    });
    return Boolean(membership);
  }

  private async acceptTenant(tenant: {
    id: string;
    name: string;
    isActive: boolean;
  }): Promise<TenantContext | null> {
    if (!tenant.isActive) return null;
    if (!(await this.canAccessTenant(tenant.id))) return null;
    this.context = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userId: this.request.user?.id,
      userRole: this.request.user?.role,
    };
    return this.context;
  }

  async resolveContext(): Promise<TenantContext> {
    if (this.context) {
      return this.context;
    }

    const domain = this.request.headers['x-tenant-domain'];
    const subdomain = this.request.headers['x-tenant-subdomain'];
    const tenantId = this.request.headers['x-tenant-id'];
    const bodyTenantId = this.request.body?.tenantId;
    const queryTenantId = this.request.query?.tenantId;
    const resolvedTenantId = tenantId || bodyTenantId || queryTenantId;

    if (resolvedTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
      });
      if (tenant) {
        const accepted = await this.acceptTenant(tenant);
        if (accepted) return accepted;
      }
    }

    if (domain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { domain },
      });
      if (tenant) {
        const accepted = await this.acceptTenant(tenant);
        if (accepted) return accepted;
      }
    }

    if (subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
      });
      if (tenant) {
        const accepted = await this.acceptTenant(tenant);
        if (accepted) return accepted;
      }
    }

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
