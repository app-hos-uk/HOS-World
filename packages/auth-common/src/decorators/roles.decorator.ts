import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific user roles.
 * Usage: @Roles('ADMIN', 'SELLER')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
