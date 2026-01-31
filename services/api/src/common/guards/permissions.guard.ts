import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Full admins without a permissionRoleId are treated as super-admins (backward compatible).
    if (String(user.role).toUpperCase() === 'ADMIN' && !user.permissionRoleId) {
      return true;
    }

    // If the user has a permission role assigned, load it.
    if (!user.permissionRoleId) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const role = await this.prisma.permissionRole.findUnique({
      where: { id: user.permissionRoleId },
      select: { permissions: true },
    });

    const permissions = Array.isArray(role?.permissions) ? (role!.permissions as any[]) : [];
    const permissionSet = new Set(permissions.map(String));

    const ok = required.every((p) => permissionSet.has(p) || permissionSet.has('*'));
    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
