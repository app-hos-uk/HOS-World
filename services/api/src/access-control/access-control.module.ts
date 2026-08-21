import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AccessControlController } from './access-control.controller';
import { AccessControlMiddleware } from './access-control.middleware';
import { AccessControlService } from './access-control.service';
import { AccessGuard } from './access.guard';
import { AccessModeService } from './access-mode.service';
import { MarketContextService } from './market-context.service';
import { MarketService } from './market.service';
import { PolicyService } from './policy.service';

@Global()
@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [AccessControlController],
  providers: [
    AccessModeService,
    MarketService,
    PolicyService,
    MarketContextService,
    AccessControlService,
    AccessGuard,
  ],
  exports: [
    AccessModeService,
    MarketService,
    PolicyService,
    MarketContextService,
    AccessControlService,
    AccessGuard,
  ],
})
export class AccessControlModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AccessControlMiddleware).forRoutes('*');
  }
}
