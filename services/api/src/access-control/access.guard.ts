import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { REQUIRE_ACCESS_KEY } from './decorators/require-access.decorator';
import type { RequireAccessMeta } from '@hos-marketplace/shared-types';
import { AccessModeService } from './access-mode.service';
import { MarketContextService } from './market-context.service';
import { PolicyService, type AssignmentSnapshot } from './policy.service';
import { PrismaService } from '../database/prisma.service';
import { applyAccessControlStore } from './access-control.als';

/**
 * Derives the module key used by ACCESS_CONTROL_MODULE_MODES from a request
 * path. The API mounts everything under the `api` global prefix and optionally
 * a `v<n>` version segment, both of which must be stripped or every route
 * would resolve to the same module and per-module rollout would be inert.
 */
export function moduleNameFromPath(path: string | undefined): string {
  if (!path) return 'unknown';
  const parts = path.split('?')[0].split('/').filter(Boolean);
  while (parts.length && (parts[0] === 'api' || /^v\d+$/i.test(parts[0]))) {
    parts.shift();
  }
  return (parts[0] || 'unknown').toLowerCase();
}

function legacyRolesAllowed(user: { role?: string }, requiredRoles: string[]): boolean {
  if (!requiredRoles.length) return true;
  if (!user?.role) return false;
  if (user.role === 'ADMIN') return true;
  return requiredRoles.some((role) => user.role === role.toUpperCase());
}

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly modes: AccessModeService,
    private readonly marketContext: MarketContextService,
    private readonly policy: PolicyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest();

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    const requireAccess = this.reflector.getAllAndOverride<RequireAccessMeta>(REQUIRE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hint = this.marketContext.extractHint(req);
    const resolved = await this.marketContext.resolve(hint, req.user);
    req.accessControl = resolved;
    req.market = resolved.market;
    // AccessControlMiddleware opened an ALS scope holding a mutable container
    // for this request; filling it here publishes the market context to every
    // service and Prisma call downstream, including inside transactions.
    applyAccessControlStore(resolved.store);

    if (isPublic) {
      return true;
    }

    // No authz metadata: authenticated user may proceed (JwtAuthGuard already ran).
    if (!requiredRoles.length && !requiredPermissions.length && !requireAccess) {
      return true;
    }

    const user = req.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const moduleName = moduleNameFromPath(req.route?.path || req.originalUrl || req.url);
    const mode = this.modes.getModuleMode(moduleName);

    const legacyOk = await this.evaluateLegacy(user, requiredRoles, requiredPermissions);
    const newDecision = this.policy.evaluate({
      userId: user.id,
      userRole: user.role,
      permissionRoleId: user.permissionRoleId,
      requiredPermission: requireAccess?.permission || requiredPermissions[0] || null,
      requiredRoles,
      scope: requireAccess?.scope,
      marketId: resolved.store.marketId,
      tenantId: resolved.store.tenantId,
      storeId: resolved.store.storeId,
      assignments: resolved.assignments,
    });

    if (mode === 'shadow' && legacyOk !== newDecision.allowed) {
      await this.logDivergence({
        userId: user.id,
        path: `${req.method} ${req.originalUrl || req.url}`,
        moduleName,
        legacyOk,
        newAllowed: newDecision.allowed,
        reason: newDecision.reason,
        requiredRoles,
        requiredPermission: requireAccess?.permission || requiredPermissions[0],
        assignments: resolved.assignments,
      });
    }

    if (mode === 'enforce') {
      if (requireAccess || requiredPermissions.length) {
        if (!newDecision.allowed) {
          throw new ForbiddenException('Insufficient permissions');
        }
        return true;
      }
      // Unmigrated route still on @Roles — keep legacy until @RequireAccess is added.
      if (!legacyOk) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return true;
    }

    // legacy + shadow: legacy decides
    if (!legacyOk) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }

  /**
   * Mirrors RolesGuard + PermissionsGuard exactly. Shadow mode compares this
   * against the policy engine, so any divergence here would produce false
   * signals and make the rollout data worthless.
   */
  private async evaluateLegacy(
    user: { role?: string; permissionRoleId?: string | null },
    requiredRoles: string[],
    requiredPermissions: string[],
  ): Promise<boolean> {
    if (requiredRoles.length && !legacyRolesAllowed(user, requiredRoles)) {
      return false;
    }
    if (!requiredPermissions.length) {
      return true;
    }
    if (String(user.role).toUpperCase() === 'ADMIN' && !user.permissionRoleId) {
      return true;
    }
    if (!user.permissionRoleId) {
      return false;
    }

    const held = await this.policy.loadRolePermissions(user.permissionRoleId);
    return requiredPermissions.every((p) => held.has(p) || held.has('*'));
  }

  private async logDivergence(payload: {
    userId: string;
    path: string;
    moduleName: string;
    legacyOk: boolean;
    newAllowed: boolean;
    reason: string;
    requiredRoles: string[];
    requiredPermission?: string;
    assignments: AssignmentSnapshot[];
  }): Promise<void> {
    this.logger.warn(
      `AccessControl divergence ${payload.path} user=${payload.userId} legacy=${payload.legacyOk} new=${payload.newAllowed} reason=${payload.reason}`,
    );
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: payload.userId,
          action: 'ACCESS_CONTROL_DIVERGENCE',
          entityType: 'AccessControl',
          description: `Shadow mode divergence on ${payload.path}`,
          metadata: {
            module: payload.moduleName,
            legacyOk: payload.legacyOk,
            newAllowed: payload.newAllowed,
            reason: payload.reason,
            requiredRoles: payload.requiredRoles,
            requiredPermission: payload.requiredPermission,
            assignmentIds: payload.assignments.map((a) => a.id),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to persist divergence: ${(e as Error).message}`);
    }
  }
}
