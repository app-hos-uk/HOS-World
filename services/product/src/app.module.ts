import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ProductsModule } from './products/products.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    DatabaseModule,
    ProductsModule,
    TaxonomyModule,
    HealthModule,
  ],
})
export class AppModule {}
