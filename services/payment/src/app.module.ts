import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { CurrencyModule } from './currency/currency.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    DatabaseModule,
    PaymentsModule,
    CurrencyModule,
    HealthModule,
  ],
})
export class AppModule {}
