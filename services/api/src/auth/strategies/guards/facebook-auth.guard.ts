import { Injectable, ExecutionContext, NotImplementedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FacebookAuthGuard extends AuthGuard('facebook') {
  canActivate(context: ExecutionContext) {
    try {
      const result = super.canActivate(context);
      if (result instanceof Promise) {
        return result.catch((err) => {
          if (err?.message?.includes('Unknown authentication strategy')) {
            throw new NotImplementedException(
              'Facebook login is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.',
            );
          }
          throw err;
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('Unknown authentication strategy')) {
        throw new NotImplementedException(
          'Facebook login is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.',
        );
      }
      throw err;
    }
  }
}
