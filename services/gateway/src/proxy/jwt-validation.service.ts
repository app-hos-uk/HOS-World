import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '@hos-marketplace/auth-common';

/**
 * JWT Validation Service
 *
 * Validates JWT tokens at the gateway level and extracts user context.
 * This is the single point of JWT validation -- downstream microservices
 * do not validate tokens, they trust the user context headers injected
 * by the gateway.
 */
@Injectable()
export class JwtValidationService {
  private readonly logger = new Logger(JwtValidationService.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Validate a JWT token and extract the user payload.
   * Returns null if the token is invalid or expired.
   */
  validateToken(token: string): AuthUser | null {
    try {
      const payload = this.jwtService.verify(token);

      return {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.role,
        permissionRoleId: payload.permissionRoleId,
        tenantId: payload.tenantId,
        sellerId: payload.sellerId,
        firstName: payload.firstName,
        lastName: payload.lastName,
      };
    } catch (error: any) {
      this.logger.debug(`JWT validation failed: ${error?.message}`);
      return null;
    }
  }

  /**
   * Extract the Bearer token from an Authorization header value.
   */
  extractToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) return null;
    return token;
  }
}
