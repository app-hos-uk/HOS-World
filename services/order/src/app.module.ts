import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    ObservabilityModule.register({ serviceName: 'order-service' }),
    EventBusModule.register({ serviceName: 'order-service', redisUrl: process.env.REDIS_URL }),
    DatabaseModule,
    OrdersModule,
    CartModule,
    HealthModule,
  ],
})
export class AppModule {}
