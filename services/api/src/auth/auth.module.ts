import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthOAuthController } from './auth.controller.oauth';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';

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
  ],
  controllers: [AuthController, AuthOAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    // Conditionally provide OAuth strategies only if configured
    // Using dynamic imports to avoid class evaluation when not needed
    {
      provide: 'GOOGLE_STRATEGY',
      useFactory: async (configService: ConfigService, authService: AuthService) => {
        const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
        if (!clientID || !clientSecret) {
          logger.debug('Google OAuth not configured - skipping strategy');
          return null;
        }
        // Dynamic import to avoid class evaluation when not configured
        const { GoogleStrategy } = await import('./strategies/google.strategy');
        return new GoogleStrategy(configService, authService);
      },
      inject: [ConfigService, AuthService],
    },
    {
      provide: 'FACEBOOK_STRATEGY',
      useFactory: async (configService: ConfigService, authService: AuthService) => {
        const appId = configService.get<string>('FACEBOOK_APP_ID');
        const appSecret = configService.get<string>('FACEBOOK_APP_SECRET');
        if (!appId || !appSecret) {
          logger.debug('Facebook OAuth not configured - skipping strategy');
          return null;
        }
        const { FacebookStrategy } = await import('./strategies/facebook.strategy');
        return new FacebookStrategy(configService, authService);
      },
      inject: [ConfigService, AuthService],
    },
    {
      provide: 'APPLE_STRATEGY',
      useFactory: async (configService: ConfigService, authService: AuthService) => {
        const clientID = configService.get<string>('APPLE_CLIENT_ID');
        const teamID = configService.get<string>('APPLE_TEAM_ID');
        const keyID = configService.get<string>('APPLE_KEY_ID');
        const privateKeyPath = configService.get<string>('APPLE_PRIVATE_KEY_PATH');
        if (!clientID || !teamID || !keyID || !privateKeyPath) {
          logger.debug('Apple OAuth not configured - skipping strategy');
          return null;
        }
        const { AppleStrategy } = await import('./strategies/apple.strategy');
        return new AppleStrategy(configService, authService);
      },
      inject: [ConfigService, AuthService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
