import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { LoggerService } from './logger.service';
import { MetricsController } from './metrics.controller';
import { MonitoringJobsService } from './jobs/monitoring.jobs';
import { DiscrepanciesModule } from '../discrepancies/discrepancies.module';
import { ActivityModule } from '../activity/activity.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    DiscrepanciesModule,
    ActivityModule,
    QueueModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [MetricsController],
  providers: [MonitoringService, MetricsService, LoggerService, MonitoringJobsService],
  exports: [MonitoringService, MetricsService, LoggerService],
})
export class MonitoringModule {}
