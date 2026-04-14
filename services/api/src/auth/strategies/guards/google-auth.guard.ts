import { Injectable, ExecutionContext, NotImplementedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    try {
      const result = super.canActivate(context);
      if (result instanceof Promise) {
        return result.catch((err) => {
          if (err?.message?.includes('Unknown authentication strategy')) {
            throw new NotImplementedException(
              'Google login is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
            );
          }
          throw err;
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('Unknown authentication strategy')) {
        throw new NotImplementedException(
          'Google login is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        );
      }
      throw err;
    }
  }
}
