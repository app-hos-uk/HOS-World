import { ForbiddenException } from '@nestjs/common';
import { AccessGuard, moduleNameFromPath } from './access.guard';

function ctx(overrides: {
  user?: any;
  isPublic?: boolean;
  roles?: string[];
  permissions?: string[];
  requireAccess?: { permission: string; scope?: string };
  path?: string;
  mode?: string;
  rolePermissions?: string[];
}) {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === 'isPublic') return overrides.isPublic;
      if (key === 'roles') return overrides.roles;
      if (key === 'permissions') return overrides.permissions;
      if (key === 'requireAccess') return overrides.requireAccess;
      return undefined;
    },
  };
  const resolved = {
    market: { id: 'm-us', code: 'US' },
    store: {
      marketId: 'm-us',
      tenantId: null,
      storeId: null,
    },
    assignments: [],
  };
  const marketContext = {
    extractHint: () => ({}),
    resolve: jest.fn().mockResolvedValue(resolved),
  };
  const policy = {
    evaluate: jest.fn().mockReturnValue({ allowed: true, reason: 'ok', isGlobalAdmin: false }),
    loadRolePermissions: jest
      .fn()
      .mockResolvedValue(new Set<string>(overrides.rolePermissions ?? [])),
  };
  const modes = {
    getModuleMode: jest.fn().mockReturnValue(overrides.mode || 'legacy'),
  };
  const prisma = { activityLog: { create: jest.fn() } };

  const guard = new AccessGuard(
    reflector as any,
    modes as any,
    marketContext as any,
    policy as any,
    prisma as any,
  );

  const request = {
    user: overrides.user,
    url: overrides.path || '/orders',
    method: 'GET',
    originalUrl: overrides.path || '/orders',
    route: { path: overrides.path || '/orders' },
    headers: {},
    header: () => undefined,
    hostname: 'localhost',
  };

  const execution = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };

  return { guard, policy, modes, prisma, request, execution };
}

describe('AccessGuard', () => {
  it('allows public routes', async () => {
    const { guard, execution } = ctx({ isPublic: true });
    await expect(guard.canActivate(execution as any)).resolves.toBe(true);
  });

  it('allows authenticated users when no roles or permissions are required', async () => {
    const { guard, execution } = ctx({ user: { id: 'u1', role: 'CUSTOMER' } });
    await expect(guard.canActivate(execution as any)).resolves.toBe(true);
  });

  it('rejects missing user on a protected route', async () => {
    const { guard, execution } = ctx({ roles: ['ADMIN'] });
    await expect(guard.canActivate(execution as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('legacy mode lets ADMIN through @Roles', async () => {
    const { guard, execution } = ctx({
      user: { id: 'u1', role: 'ADMIN' },
      roles: ['FINANCE'],
    });
    await expect(guard.canActivate(execution as any)).resolves.toBe(true);
  });

  it('legacy mode denies a customer on a finance route', async () => {
    const { guard, execution } = ctx({
      user: { id: 'u1', role: 'CUSTOMER' },
      roles: ['FINANCE', 'ADMIN'],
    });
    await expect(guard.canActivate(execution as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves the module from the path behind the api prefix and version', async () => {
    const { guard, modes, execution } = ctx({
      user: { id: 'u1', role: 'ADMIN' },
      roles: ['ADMIN'],
      path: '/api/v1/settlements/:id',
    });
    await guard.canActivate(execution as any);
    expect(modes.getModuleMode).toHaveBeenCalledWith('settlements');
  });

  it('denies when the user permission role lacks the required permission', async () => {
    const { guard, execution } = ctx({
      user: { id: 'u1', role: 'ADMIN', permissionRoleId: 'r1' },
      permissions: ['orders.refund'],
      rolePermissions: ['orders.view'],
    });
    await expect(guard.canActivate(execution as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when the user permission role holds the required permission', async () => {
    const { guard, execution } = ctx({
      user: { id: 'u1', role: 'ADMIN', permissionRoleId: 'r1' },
      permissions: ['orders.view'],
      rolePermissions: ['orders.view'],
    });
    await expect(guard.canActivate(execution as any)).resolves.toBe(true);
  });

  it('does not log a divergence in shadow mode when both engines agree', async () => {
    const { guard, prisma, execution } = ctx({
      user: { id: 'u1', role: 'ADMIN', permissionRoleId: 'r1' },
      permissions: ['orders.view'],
      rolePermissions: ['orders.view'],
      mode: 'shadow',
    });
    await guard.canActivate(execution as any);
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });
});

describe('moduleNameFromPath', () => {
  it.each([
    ['/api/orders/:id', 'orders'],
    ['/api/v1/orders/:id', 'orders'],
    ['/api/v2/finance/payouts', 'finance'],
    ['/orders', 'orders'],
    ['/api/settlements?status=OPEN', 'settlements'],
    ['/api', 'unknown'],
    [undefined, 'unknown'],
  ])('maps %s to %s', (path, expected) => {
    expect(moduleNameFromPath(path as string | undefined)).toBe(expected);
  });
});
