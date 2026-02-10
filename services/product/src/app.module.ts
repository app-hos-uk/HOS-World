import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { ProductsModule } from './products/products.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    ObservabilityModule.register({ serviceName: 'product-service' }),
    EventBusModule.register({ serviceName: 'product-service', redisUrl: process.env.REDIS_URL }),
    DatabaseModule,
    ProductsModule,
    TaxonomyModule,
    HealthModule,
  ],
})
export class AppModule {}
