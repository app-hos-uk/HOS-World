import { PolicyService, type AssignmentSnapshot } from './policy.service';

function assignment(
  overrides: Partial<AssignmentSnapshot> & Pick<AssignmentSnapshot, 'permissions' | 'scopeType'>,
): AssignmentSnapshot {
  return {
    id: overrides.id || 'a1',
    permissionRoleName: overrides.permissionRoleName || 'FINANCE',
    permissions: overrides.permissions,
    scopeType: overrides.scopeType,
    scopeId: overrides.scopeId ?? null,
    isActive: overrides.isActive ?? true,
  };
}

describe('PolicyService.evaluate', () => {
  const policy = new PolicyService({} as any);

  it('allows global ADMIN with no assignments (backward compatible super-admin)', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'ADMIN',
      requiredPermission: 'orders.view',
      assignments: [],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.isGlobalAdmin).toBe(true);
  });

  it('allows ADMIN with a GLOBAL assignment', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'ADMIN',
      requiredPermission: 'system.permissions',
      assignments: [assignment({ permissions: ['*'], scopeType: 'GLOBAL' })],
    });
    expect(decision.allowed).toBe(true);
  });

  it('denies market-scoped finance user on a different market', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'FINANCE',
      requiredPermission: 'orders.view',
      scope: 'MARKET',
      marketId: 'market-gb',
      assignments: [
        assignment({
          permissions: ['orders.view', 'orders.refund'],
          scopeType: 'MARKET',
          scopeId: 'market-us',
        }),
      ],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('permission-denied');
  });

  it('allows market-scoped finance user on their market', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'FINANCE',
      requiredPermission: 'orders.view',
      scope: 'MARKET',
      marketId: 'market-gb',
      assignments: [
        assignment({
          permissions: ['orders.view'],
          scopeType: 'MARKET',
          scopeId: 'market-gb',
        }),
      ],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('assignment-permission');
  });

  it('matches platform role when only @Roles is present', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'FINANCE',
      requiredRoles: ['FINANCE', 'ADMIN'],
      assignments: [],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('platform-role');
  });

  it('denies a seller using a staff-only role list', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'B2C_SELLER',
      requiredRoles: ['ADMIN', 'FINANCE'],
      assignments: [],
    });
    expect(decision.allowed).toBe(false);
  });

  it('treats an assignment with no scopeId as covering the active market', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'B2C_SELLER',
      requiredPermission: 'products.view',
      scope: 'MARKET',
      marketId: 'market-gb',
      assignments: [
        assignment({ permissions: ['products.view'], scopeType: 'MARKET', scopeId: null }),
      ],
    });
    expect(decision.allowed).toBe(true);
  });

  it('requires a GLOBAL assignment for a GLOBAL-scoped permission', () => {
    const decision = policy.evaluate({
      userId: 'u1',
      userRole: 'FINANCE',
      requiredPermission: 'system.permissions',
      scope: 'GLOBAL',
      marketId: 'market-gb',
      assignments: [
        assignment({
          permissions: ['system.permissions'],
          scopeType: 'MARKET',
          scopeId: 'market-gb',
        }),
      ],
    });
    expect(decision.allowed).toBe(false);
  });

  it('does not treat an ADMIN narrowed to a permission role as super-admin', () => {
    const restricted = [
      assignment({
        id: 'implicit:permission-role:r1',
        permissionRoleName: 'SUPPORT',
        permissions: ['orders.view'],
        scopeType: 'MARKET',
        scopeId: null,
      }),
    ];
    expect(policy.isGlobalAdmin('ADMIN', restricted)).toBe(false);
    expect(
      policy.evaluate({
        userId: 'u1',
        userRole: 'ADMIN',
        requiredPermission: 'orders.refund',
        marketId: 'market-gb',
        assignments: restricted,
      }).allowed,
    ).toBe(false);
  });
});

describe('PolicyService.loadAssignments', () => {
  function serviceWith(overrides: { rows?: unknown[]; permissionRole?: unknown }) {
    const prisma = {
      userRoleAssignment: { findMany: jest.fn().mockResolvedValue(overrides.rows ?? []) },
      permissionRole: {
        findUnique: jest.fn().mockResolvedValue(overrides.permissionRole ?? null),
      },
    };
    return { policy: new PolicyService(prisma as any), prisma };
  }

  it('derives an implicit assignment from the platform role when none exist', async () => {
    const { policy } = serviceWith({});
    const assignments = await policy.loadAssignments({ id: 'u1', role: 'B2C_SELLER' });

    expect(assignments).toHaveLength(1);
    expect(assignments[0].isImplicit).toBe(true);
    expect(assignments[0].permissionRoleName).toBe('B2C_SELLER');
    expect(assignments[0].permissions.length).toBeGreaterThan(0);
  });

  it('gives an unassigned ADMIN a GLOBAL implicit assignment', async () => {
    const { policy } = serviceWith({});
    const assignments = await policy.loadAssignments({ id: 'u1', role: 'ADMIN' });

    expect(assignments[0].scopeType).toBe('GLOBAL');
    expect(policy.isGlobalAdmin('ADMIN', assignments)).toBe(true);
  });

  it('honours the permission role attached to the user record', async () => {
    const { policy } = serviceWith({
      permissionRole: {
        id: 'r1',
        name: 'SUPPORT',
        permissions: ['orders.view'],
        scopeKind: 'ANY',
      },
    });
    const assignments = await policy.loadAssignments({
      id: 'u1',
      role: 'ADMIN',
      permissionRoleId: 'r1',
    });

    expect(assignments).toHaveLength(1);
    expect(assignments[0].permissions).toEqual(['orders.view']);
    // ANY must not become GLOBAL, or the role would confer super-admin.
    expect(assignments[0].scopeType).toBe('MARKET');
  });

  it('caches per user and refreshes after invalidate', async () => {
    const { policy, prisma } = serviceWith({});
    await policy.loadAssignments({ id: 'u1', role: 'CUSTOMER' });
    await policy.loadAssignments({ id: 'u1', role: 'CUSTOMER' });
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(1);

    policy.invalidate('u1');
    await policy.loadAssignments({ id: 'u1', role: 'CUSTOMER' });
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(2);
  });
});
