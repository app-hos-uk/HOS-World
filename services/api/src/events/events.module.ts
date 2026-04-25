import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TemplatesModule } from '../templates/templates.module';
import { JourneyModule } from '../journeys/journey.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsAdminController } from './events-admin.controller';
import { EventJobsService } from './jobs/event.jobs';
import { SegmentationModule } from '../segmentation/segmentation.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
    LoyaltyModule,
    SegmentationModule,
    NotificationsModule,
    TemplatesModule,
    forwardRef(() => JourneyModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return { secret };
      },
    }),
  ],
  controllers: [EventsController, EventsAdminController],
  providers: [EventsService, EventJobsService],
  exports: [EventsService],
})
export class EventsModule {}
