import { Module, MiddlewareConsumer, NestModule, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ProxyMiddleware } from './proxy.middleware';
import { JwtValidationService } from './jwt-validation.service';
import { getServiceConfigs } from '../config/services.config';

/**
 * Proxy Module
 *
 * Registers the ProxyMiddleware for each service's route prefixes.
 * The middleware validates JWT, injects user context headers, and proxies
 * the request to the appropriate downstream service.
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtValidationService, ProxyMiddleware],
})
export class ProxyModule implements NestModule {
  private readonly logger = new Logger(ProxyModule.name);

  configure(consumer: MiddlewareConsumer) {
    const services = getServiceConfigs();

    // Log active routing
    for (const svc of services) {
      if (svc.enabled && svc.name !== 'monolith-api') {
        this.logger.log(
          `Routing ${svc.prefixes.join(', ')} -> ${svc.name} (${svc.url})`,
        );
      }
    }

    // The fallback monolith route covers everything under /api
    this.logger.log('Fallback: all unmatched /api/* -> monolith-api');

    // Apply proxy middleware to /api/*
    consumer.apply(ProxyMiddleware).forRoutes('/api/*');
  }
}
