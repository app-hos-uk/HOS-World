import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { CurrencyModule } from './currency/currency.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    ObservabilityModule.register({ serviceName: 'payment-service' }),
    EventBusModule.register({ serviceName: 'payment-service', redisUrl: process.env.REDIS_URL }),
    DatabaseModule,
    PaymentsModule,
    CurrencyModule,
    HealthModule,
  ],
})
export class AppModule {}
