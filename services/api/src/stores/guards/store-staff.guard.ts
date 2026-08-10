import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Admits ADMIN or STORE_STAFF. For STORE_STAFF, requires user.storeId
 * and exposes it on the request as `storeId` for controllers.
 */
@Injectable()
export class StoreStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (user.role === 'ADMIN') {
      // Admin may optionally scope via body/query; leave req.storeId unset unless present.
      if (user.storeId) {
        req.storeId = user.storeId;
      }
      return true;
    }

    if (user.role === 'STORE_STAFF') {
      if (!user.storeId) {
        throw new ForbiddenException('Store staff must be assigned to a store');
      }
      req.storeId = user.storeId;
      return true;
    }

    throw new ForbiddenException('Store staff or admin access required');
  }
}
