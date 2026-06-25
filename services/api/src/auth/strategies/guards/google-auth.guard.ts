import { Injectable, ExecutionContext, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

const OAUTH_NOT_CONFIGURED_MSG = 'Social login is not configured';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new NotImplementedException(OAUTH_NOT_CONFIGURED_MSG);
    }

    try {
      const result = super.canActivate(context);
      if (result instanceof Promise) {
        return result.catch((err) => {
          if (err?.message?.includes('Unknown authentication strategy')) {
            throw new NotImplementedException(OAUTH_NOT_CONFIGURED_MSG);
          }
          throw err;
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('Unknown authentication strategy')) {
        throw new NotImplementedException(OAUTH_NOT_CONFIGURED_MSG);
      }
      throw err;
    }
  }
}
