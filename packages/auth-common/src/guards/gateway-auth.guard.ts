import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Gateway Auth Guard
 *
 * Used by downstream microservices that receive requests already authenticated
 * by the API Gateway. Instead of validating JWT tokens directly, this guard
 * reads the user context from headers set by the gateway:
 *
 *   X-User-Id, X-User-Email, X-User-Role, X-Tenant-Id, etc.
 *
 * This avoids each microservice needing JWT/Passport dependencies.
 */
@Injectable()
export class GatewayAuthGuard implements CanActivate {
  private readonly logger = new Logger(GatewayAuthGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Always allow OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Extract user context from gateway-injected headers
    const userId = request.headers['x-user-id'];
    const userEmail = request.headers['x-user-email'];
    const userRole = request.headers['x-user-role'];

    if (!userId || !userEmail || !userRole) {
      throw new UnauthorizedException(
        'Missing authentication context. Requests must go through the API Gateway.',
      );
    }

    // Attach user to request (same shape as JWT-authenticated user)
    const authUser: AuthUser = {
      id: userId,
      email: userEmail,
      role: userRole,
      tenantId: request.headers['x-tenant-id'] || undefined,
      permissionRoleId: request.headers['x-user-permission-role-id'] || undefined,
      sellerId: request.headers['x-user-seller-id'] || undefined,
      firstName: request.headers['x-user-first-name'] || undefined,
      lastName: request.headers['x-user-last-name'] || undefined,
    };

    request.user = authUser;

    return true;
  }
}
