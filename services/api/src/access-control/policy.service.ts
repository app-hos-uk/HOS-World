import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS, type AccessScopeType } from '@hos-marketplace/shared-types';

export interface AssignmentSnapshot {
  id: string;
  permissionRoleName: string;
  permissions: string[];
  scopeType: AccessScopeType;
  scopeId: string | null;
  isActive: boolean;
  /**
   * True when the assignment was derived from the user's platform role or
   * `permissionRoleId` rather than a `user_role_assignments` row. Implicit
   * assignments keep pre-migration users (and new signups, which never get a
   * row) working once a route moves to `@RequireAccess`.
   */
  isImplicit?: boolean;
}

export interface PolicySubject {
  id: string;
  role?: string | null;
  permissionRoleId?: string | null;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  matchedAssignmentId?: string;
  isGlobalAdmin: boolean;
}

export interface EvaluateInput {
  userId: string;
  userRole: string;
  permissionRoleId?: string | null;
  requiredPermission?: string | null;
  requiredRoles?: string[];
  scope?: AccessScopeType | 'SELF';
  marketId?: string | null;
  tenantId?: string | null;
  storeId?: string | null;
  assignments: AssignmentSnapshot[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function permissionMatches(held: string[], required: string): boolean {
  if (held.includes('*')) return true;
  if (held.includes(required)) return true;
  const [resource] = required.split('.');
  if (resource && held.includes(`${resource}.*`)) return true;
  return false;
}

/**
 * Maps a PermissionRole.scopeKind onto the scope an implicit assignment sits at.
 * `ANY` deliberately resolves to MARKET rather than GLOBAL: a role attached to
 * a user must not silently confer super-admin.
 */
function scopeKindToScopeType(scopeKind: string | null | undefined): AccessScopeType {
  switch ((scopeKind || 'ANY').toUpperCase()) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'TENANT':
      return 'TENANT';
    case 'STORE':
      return 'STORE';
    default:
      return 'MARKET';
  }
}

function scopeCovers(
  assignment: AssignmentSnapshot,
  required: AccessScopeType | 'SELF' | undefined,
  ctx: { marketId?: string | null; tenantId?: string | null; storeId?: string | null },
): boolean {
  if (assignment.scopeType === 'GLOBAL') return true;
  // An assignment with no scopeId is not narrowed to a particular market,
  // tenant or store, so it covers whatever context the request resolved to.
  if (assignment.scopeId === null) return required !== 'GLOBAL';
  // Only a GLOBAL assignment satisfies a GLOBAL requirement, and that case
  // already returned above.
  if (required === 'GLOBAL') return false;
  // SELF is enforced by the ownership policies at the service layer; any
  // assignment that reaches this point is scope-compatible.
  if (required === 'SELF') return true;

  if (assignment.scopeType === 'MARKET') {
    if (!ctx.marketId) return false;
    return assignment.scopeId === ctx.marketId;
  }
  if (assignment.scopeType === 'TENANT') {
    if (!ctx.tenantId) return false;
    return assignment.scopeId === ctx.tenantId;
  }
  if (assignment.scopeType === 'STORE') {
    if (!ctx.storeId) return false;
    return assignment.scopeId === ctx.storeId;
  }
  return false;
}

const ASSIGNMENT_TTL_MS = Number(process.env.ACCESS_CONTROL_ASSIGNMENT_TTL_MS || 15_000);
const ASSIGNMENT_CACHE_MAX = Number(process.env.ACCESS_CONTROL_ASSIGNMENT_CACHE_MAX || 5_000);

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private readonly cache = new Map<string, { value: AssignmentSnapshot[]; expiresAt: number }>();
  private readonly roleCache = new Map<string, { value: Set<string>; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves every assignment that applies to a user: explicit rows first, then
   * the permission role attached to the user record, then a role-derived
   * fallback. Cached briefly so the guard does not add a query per request;
   * `invalidate()` is called whenever assignments or roles change.
   */
  async loadAssignments(subject: PolicySubject | string): Promise<AssignmentSnapshot[]> {
    const user: PolicySubject = typeof subject === 'string' ? { id: subject } : subject;
    const cached = this.cache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const resolved = await this.resolveAssignments(user);
    if (this.cache.size >= ASSIGNMENT_CACHE_MAX) {
      this.evictExpired();
      if (this.cache.size >= ASSIGNMENT_CACHE_MAX) {
        // Map preserves insertion order, so the first key is the oldest entry.
        const oldest = this.cache.keys().next();
        if (!oldest.done) this.cache.delete(oldest.value);
      }
    }
    this.cache.set(user.id, { value: resolved, expiresAt: Date.now() + ASSIGNMENT_TTL_MS });
    return resolved;
  }

  /**
   * Permissions held by a PermissionRole. Shared with AccessGuard's legacy
   * evaluation so both engines read the same snapshot and there is a single
   * cache to invalidate.
   */
  async loadRolePermissions(permissionRoleId: string): Promise<Set<string>> {
    const cached = this.roleCache.get(permissionRoleId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    try {
      const role = await this.prisma.permissionRole.findUnique({
        where: { id: permissionRoleId },
        select: { permissions: true },
      });
      const held = new Set(asStringArray(role?.permissions));
      this.roleCache.set(permissionRoleId, {
        value: held,
        expiresAt: Date.now() + ASSIGNMENT_TTL_MS,
      });
      return held;
    } catch (e) {
      this.logger.warn(`Permission role lookup failed: ${(e as Error).message}`);
      // Not cached: a transient failure must not pin an empty permission set.
      return new Set<string>();
    }
  }

  /**
   * Drops cached authorization state. Call after any change to permission
   * roles or role assignments, otherwise edits take up to the TTL to apply.
   */
  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
    this.roleCache.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }

  private async resolveAssignments(user: PolicySubject): Promise<AssignmentSnapshot[]> {
    const platformRole = (user.role || '').toUpperCase();
    let explicit: AssignmentSnapshot[] = [];

    try {
      const rows = await this.prisma.userRoleAssignment.findMany({
        where: { userId: user.id, isActive: true },
        include: { permissionRole: { select: { name: true, permissions: true } } },
      });
      explicit = rows.map((r) => ({
        id: r.id,
        permissionRoleName: r.permissionRole.name,
        permissions: asStringArray(r.permissionRole.permissions),
        scopeType: r.scopeType as AccessScopeType,
        scopeId: r.scopeId,
        isActive: r.isActive,
      }));
    } catch (e) {
      this.logger.warn(`loadAssignments failed: ${(e as Error).message}`);
      // Fall through to the implicit assignments so a transient failure cannot
      // silently widen access; the role-derived set is never broader than the
      // legacy behaviour.
    }

    const implicit: AssignmentSnapshot[] = [];

    // A permission role attached directly to the user is what PermissionsGuard
    // reads, so the policy engine must honour it too or the two disagree.
    if (user.permissionRoleId) {
      try {
        const role = await this.prisma.permissionRole.findUnique({
          where: { id: user.permissionRoleId },
          select: { id: true, name: true, permissions: true, scopeKind: true },
        });
        if (role) {
          implicit.push({
            id: `implicit:permission-role:${role.id}`,
            permissionRoleName: role.name,
            permissions: asStringArray(role.permissions),
            scopeType: scopeKindToScopeType(role.scopeKind),
            scopeId: null,
            isActive: true,
            isImplicit: true,
          });
        }
      } catch (e) {
        this.logger.warn(`permissionRole lookup failed: ${(e as Error).message}`);
      }
    }

    // Role-derived fallback for users with no explicit assignment and no
    // permission role — i.e. everybody created before the migration and every
    // new signup. Without this, enforce mode denies all non-admin traffic.
    if (explicit.length === 0 && implicit.length === 0 && platformRole) {
      const permissions = DEFAULT_ROLE_PERMISSIONS[platformRole];
      if (permissions?.length) {
        implicit.push({
          id: `implicit:platform-role:${platformRole}`,
          permissionRoleName: platformRole,
          permissions: [...permissions],
          scopeType: platformRole === 'ADMIN' ? 'GLOBAL' : 'MARKET',
          scopeId: null,
          isActive: true,
          isImplicit: true,
        });
      }
    }

    return [...explicit, ...implicit];
  }

  isGlobalAdmin(userRole: string, assignments: AssignmentSnapshot[]): boolean {
    if (userRole.toUpperCase() !== 'ADMIN') return false;
    // An ADMIN narrowed to a specific permission role is not a super-admin;
    // this mirrors PermissionsGuard, which only short-circuits when the user
    // has no permissionRoleId.
    const scoped = assignments.filter((a) => a.isActive);
    if (scoped.length === 0) return true; // backward compatible super-admin
    return scoped.some((a) => a.scopeType === 'GLOBAL');
  }

  allowedMarketIds(assignments: AssignmentSnapshot[], allMarketIds: string[]): string[] {
    if (assignments.some((a) => a.scopeType === 'GLOBAL')) return [...allMarketIds];
    return assignments
      .filter((a) => a.scopeType === 'MARKET' && a.scopeId)
      .map((a) => a.scopeId as string);
  }

  evaluate(input: EvaluateInput): PolicyDecision {
    const role = (input.userRole || '').toUpperCase();
    const globalAdmin = this.isGlobalAdmin(role, input.assignments);
    if (globalAdmin) {
      return { allowed: true, reason: 'global-admin', isGlobalAdmin: true };
    }

    const required = input.requiredPermission;
    const requiredRoles = (input.requiredRoles || []).map((r) => r.toUpperCase());

    if (!required && requiredRoles.length === 0) {
      return { allowed: true, reason: 'no-requirement', isGlobalAdmin: false };
    }

    // Role-path: assignment whose permission-role name matches a required role,
    // or the platform UserRole itself matches (day-one compat).
    if (!required && requiredRoles.length > 0) {
      if (requiredRoles.includes(role)) {
        return { allowed: true, reason: 'platform-role', isGlobalAdmin: false };
      }
      const match = input.assignments.find(
        (a) =>
          a.isActive &&
          requiredRoles.includes(a.permissionRoleName.toUpperCase()) &&
          scopeCovers(a, input.scope, input),
      );
      if (match) {
        return {
          allowed: true,
          reason: 'assignment-role',
          matchedAssignmentId: match.id,
          isGlobalAdmin: false,
        };
      }
      return { allowed: false, reason: 'role-mismatch', isGlobalAdmin: false };
    }

    if (required) {
      const match = input.assignments.find(
        (a) =>
          a.isActive &&
          permissionMatches(a.permissions, required) &&
          scopeCovers(a, input.scope ?? 'MARKET', input),
      );
      if (match) {
        return {
          allowed: true,
          reason: 'assignment-permission',
          matchedAssignmentId: match.id,
          isGlobalAdmin: false,
        };
      }
      // Fallback: platform role still holds the permission via default catalog
      // only when no assignments exist (unmigrated user).
      if (input.assignments.length === 0 && requiredRoles.includes(role)) {
        return { allowed: true, reason: 'unmigrated-role-fallback', isGlobalAdmin: false };
      }
      return { allowed: false, reason: 'permission-denied', isGlobalAdmin: false };
    }

    return { allowed: false, reason: 'denied', isGlobalAdmin: false };
  }
}
