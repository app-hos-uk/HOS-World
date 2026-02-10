import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SellersModule } from './sellers/sellers.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule.register({ serviceName: 'seller-service' }),
    EventBusModule.register({
      name: 'seller-service',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    DatabaseModule,
    HealthModule,
    SellersModule,
    SubmissionsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
