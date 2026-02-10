import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    DatabaseModule,
    OrdersModule,
    CartModule,
    HealthModule,
  ],
})
export class AppModule {}
