import { Module, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthOAuthController } from './auth.controller.oauth';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';

const logger = new Logger('AuthModule');

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => AdminModule),
  ],
  controllers: [AuthController, AuthOAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async onModuleInit() {
    // Don't block startup - register OAuth strategies in background
    // Using dynamic imports to avoid class evaluation when not needed
    Promise.resolve().then(async () => {
      // Google Strategy
      const googleClientID = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
      if (googleClientID && googleClientSecret) {
        try {
          const { GoogleStrategy } = await import('./strategies/google.strategy');
          new GoogleStrategy(this.configService, this.authService);
          logger.log('Google OAuth strategy registered');
        } catch (error) {
          logger.warn('Failed to register Google OAuth strategy:', error.message);
        }
      } else {
        logger.debug('Google OAuth not configured - skipping strategy');
      }

      // Facebook Strategy
      const facebookAppId = this.configService.get<string>('FACEBOOK_APP_ID');
      const facebookAppSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
      if (facebookAppId && facebookAppSecret) {
        try {
          const { FacebookStrategy } = await import('./strategies/facebook.strategy');
          new FacebookStrategy(this.configService, this.authService);
          logger.log('Facebook OAuth strategy registered');
        } catch (error) {
          logger.warn('Failed to register Facebook OAuth strategy:', error.message);
        }
      } else {
        logger.debug('Facebook OAuth not configured - skipping strategy');
      }

      // Apple Strategy
      const appleClientID = this.configService.get<string>('APPLE_CLIENT_ID');
      const appleTeamID = this.configService.get<string>('APPLE_TEAM_ID');
      const appleKeyID = this.configService.get<string>('APPLE_KEY_ID');
      const applePrivateKeyPath = this.configService.get<string>('APPLE_PRIVATE_KEY_PATH');
      if (appleClientID && appleTeamID && appleKeyID && applePrivateKeyPath) {
        try {
          const { AppleStrategy } = await import('./strategies/apple.strategy');
          new AppleStrategy(this.configService, this.authService);
          logger.log('Apple OAuth strategy registered');
        } catch (error) {
          logger.warn('Failed to register Apple OAuth strategy:', error.message);
        }
      } else {
        logger.debug('Apple OAuth not configured - skipping strategy');
      }
    }).catch(() => {
      // Ignore errors - don't block startup
    });
  }
}
