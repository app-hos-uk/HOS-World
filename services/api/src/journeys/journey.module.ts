import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { MessagingModule } from '../messaging/messaging.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { JourneyService } from './journey.service';
import { MarketingEventBus } from './marketing-event.bus';
import { MarketingJobsService } from './jobs/marketing.jobs';
import { MessagingApiController } from './messaging-api.controller';
import { JourneyAdminController, MessagingAdminController } from './journey-admin.controller';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
    MessagingModule,
    // Expiry-warning emails need the same expiry horizon the sweep uses.
    forwardRef(() => LoyaltyModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return { secret, signOptions: { expiresIn: '30d' } };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [MessagingApiController, JourneyAdminController, MessagingAdminController],
  providers: [JourneyService, MarketingEventBus, MarketingJobsService],
  exports: [JourneyService, MarketingEventBus, MessagingModule],
})
export class JourneyModule {}
