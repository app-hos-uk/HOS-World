import { Injectable, ExecutionContext, NotImplementedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AppleAuthGuard extends AuthGuard('apple') {
  canActivate(context: ExecutionContext) {
    try {
      const result = super.canActivate(context);
      if (result instanceof Promise) {
        return result.catch((err) => {
          if (err?.message?.includes('Unknown authentication strategy')) {
            throw new NotImplementedException(
              'Apple login is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY_PATH.',
            );
          }
          throw err;
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('Unknown authentication strategy')) {
        throw new NotImplementedException(
          'Apple login is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY_PATH.',
        );
      }
      throw err;
    }
  }
}
