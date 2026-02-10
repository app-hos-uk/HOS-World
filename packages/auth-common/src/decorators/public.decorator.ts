import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public (no JWT authentication required).
 * When applied to a controller method, the JwtAuthGuard will skip token validation.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
