import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { ShippingModule } from './shipping/shipping.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { LogisticsModule } from './logistics/logistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule.register({ serviceName: 'inventory-service' }),
    EventBusModule.register({
      name: 'inventory-service',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    DatabaseModule,
    HealthModule,
    InventoryModule,
    ShippingModule,
    FulfillmentModule,
    LogisticsModule,
  ],
})
export class AppModule {}
