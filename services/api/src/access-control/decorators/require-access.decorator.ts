import { SetMetadata } from '@nestjs/common';
import type { RequireAccessMeta } from '@hos-marketplace/shared-types';

export const REQUIRE_ACCESS_KEY = 'requireAccess';

/**
 * Declares the permission + scope the new policy engine evaluates.
 * Pair with AccessGuard (registered globally). Legacy @Roles stays in place
 * until a module is flipped to enforce.
 */
export const RequireAccess = (meta: RequireAccessMeta) => SetMetadata(REQUIRE_ACCESS_KEY, meta);
