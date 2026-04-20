import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { MessagingModule } from '../messaging/messaging.module';
import { SegmentationService } from './segmentation.service';
import { SegmentationAdminController } from './segmentation-admin.controller';
import { SegmentJobsService } from './jobs/segment.jobs';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, MessagingModule],
  controllers: [SegmentationAdminController],
  providers: [SegmentationService, SegmentJobsService],
  exports: [SegmentationService],
})
export class SegmentationModule {}
