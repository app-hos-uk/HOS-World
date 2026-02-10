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

    // Extract user context from gateway-injected headers.
    // Express headers can be string | string[] | undefined, so we
    // normalise to the first value to guarantee a string.
    const userId = this.headerToString(request.headers['x-user-id']);
    const userEmail = this.headerToString(request.headers['x-user-email']);
    const userRole = this.headerToString(request.headers['x-user-role']);

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
      tenantId: this.headerToString(request.headers['x-tenant-id']) || undefined,
      permissionRoleId: this.headerToString(request.headers['x-user-permission-role-id']) || undefined,
      sellerId: this.headerToString(request.headers['x-user-seller-id']) || undefined,
      firstName: this.headerToString(request.headers['x-user-first-name']) || undefined,
      lastName: this.headerToString(request.headers['x-user-last-name']) || undefined,
    };

    request.user = authUser;

    return true;
  }

  /**
   * Normalise an Express header value to a plain string.
   * Headers can be string | string[] | undefined when a client
   * sends duplicate header names. We always take the first value.
   */
  private headerToString(
    value: string | string[] | undefined,
  ): string | undefined {
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}
