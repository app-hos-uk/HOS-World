import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  type AccessControlMe,
  type MarketSummary,
  PERMISSION_CATALOG,
} from '@hos-marketplace/shared-types';
import { PrismaService } from '../database/prisma.service';
import { isPinnedToSingleMarket } from './market-context.service';
import { MarketService } from './market.service';
import { PolicyService } from './policy.service';
import type { MarketRow } from './market.service';

function toSummary(m: MarketRow): MarketSummary {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    country: m.country,
    countryCode: m.countryCode,
    currency: m.currency,
    locale: m.locale,
    timezone: m.timezone,
    isActive: m.isActive,
    isDefault: m.isDefault,
  };
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly markets: MarketService,
    private readonly policy: PolicyService,
  ) {}

  getCatalog() {
    return PERMISSION_CATALOG.map((p) => ({ ...p }));
  }

  async bumpTokenVersion(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch (e) {
      this.logger.warn(`bumpTokenVersion failed: ${(e as Error).message}`);
    } finally {
      // Permissions just changed, so the cached assignment snapshot is stale.
      this.policy.invalidate(userId);
    }
  }

  async listAssignments(userId: string) {
    return this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: { permissionRole: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAssignment(data: {
    userId: string;
    permissionRoleId: string;
    scopeType: string;
    scopeId?: string | null;
  }) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: data.userId } }),
      this.prisma.permissionRole.findUnique({ where: { id: data.permissionRoleId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('PermissionRole not found');

    if (data.scopeType === 'GLOBAL' && data.scopeId) {
      throw new BadRequestException('scopeId must be null when scopeType is GLOBAL');
    }
    if (data.scopeType !== 'GLOBAL' && !data.scopeId) {
      throw new BadRequestException('scopeId is required when scopeType is not GLOBAL');
    }

    const assignment = await this.prisma.userRoleAssignment.create({
      data: {
        userId: data.userId,
        permissionRoleId: data.permissionRoleId,
        scopeType: data.scopeType,
        scopeId: data.scopeId ?? null,
      },
      include: { permissionRole: true },
    });

    await this.bumpTokenVersion(data.userId);
    return assignment;
  }

  async deleteAssignment(id: string) {
    const assignment = await this.prisma.userRoleAssignment.findUnique({
      where: { id },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    await this.prisma.userRoleAssignment.delete({ where: { id } });
    await this.bumpTokenVersion(assignment.userId);

    return { deleted: true };
  }

  async listRoles() {
    return this.prisma.permissionRole.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        permissions: true,
        scopeKind: true,
        isSystem: true,
        createdAt: true,
      },
    });
  }

  async updateRole(id: string, data: { permissions?: string[]; scopeKind?: string }) {
    const role = await this.prisma.permissionRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('PermissionRole not found');

    const updated = await this.prisma.permissionRole.update({
      where: { id },
      data,
    });

    this.policy.invalidate();
    return updated;
  }

  async listStores() {
    return this.prisma.store.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async getMe(user: {
    id: string;
    role: string;
    homeMarketId?: string | null;
    permissionRoleId?: string | null;
  }): Promise<AccessControlMe> {
    const assignments = await this.policy.loadAssignments({
      id: user.id,
      role: user.role,
      permissionRoleId: user.permissionRoleId,
    });
    const allMarkets = await this.markets.listActive();
    const isGlobalAdmin = this.policy.isGlobalAdmin(user.role, assignments);
    const allowedIds = this.policy.allowedMarketIds(
      assignments,
      allMarkets.map((m) => m.id),
    );
    // Must mirror MarketContextService.canUseMarket, otherwise the switcher
    // would offer markets the API then rejects — or hide ones it would accept.
    const visible = isGlobalAdmin
      ? allMarkets
      : allowedIds.length > 0
        ? allMarkets.filter((m) => allowedIds.includes(m.id))
        : isPinnedToSingleMarket(assignments) && user.homeMarketId
          ? allMarkets.filter((m) => m.id === user.homeMarketId)
          : allMarkets;

    const permissionSet = new Set<string>();
    for (const a of assignments) {
      for (const p of a.permissions) permissionSet.add(p);
    }
    if (isGlobalAdmin) permissionSet.add('*');

    const home =
      (user.homeMarketId && allMarkets.find((m) => m.id === user.homeMarketId)) ||
      allMarkets.find((m) => m.isDefault) ||
      visible[0] ||
      null;

    return {
      userId: user.id,
      role: user.role,
      isGlobalAdmin,
      permissions: [...permissionSet],
      assignments: assignments.map((a) => ({
        id: a.id,
        permissionRoleName: a.permissionRoleName,
        permissions: a.permissions,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
      })),
      markets: visible.map(toSummary),
      activeMarket: home ? toSummary(home) : null,
    };
  }
}
