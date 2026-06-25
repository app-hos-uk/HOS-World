import { Injectable, ExecutionContext, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

const OAUTH_NOT_CONFIGURED_MSG = 'Social login is not configured';

@Injectable()
export class AppleAuthGuard extends AuthGuard('apple') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    const teamId = this.configService.get<string>('APPLE_TEAM_ID');
    const keyId = this.configService.get<string>('APPLE_KEY_ID');
    const privateKeyPath = this.configService.get<string>('APPLE_PRIVATE_KEY_PATH');
    if (!clientId?.trim() || !teamId?.trim() || !keyId?.trim() || !privateKeyPath?.trim()) {
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
