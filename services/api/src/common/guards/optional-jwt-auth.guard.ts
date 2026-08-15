import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Populates `req.user` when a valid bearer token is present, but lets
 * anonymous callers through.
 *
 * For endpoints that must stay reachable by guests yet can give a signed-in
 * caller a better answer. Pair it with `@Public()` so the global JwtAuthGuard
 * does not reject the request before this one runs.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // A missing, expired, or malformed token is not an error here — the
      // request simply proceeds as anonymous.
    }
    return true;
  }

  handleRequest(_err: any, user: any) {
    return user || undefined;
  }
}
