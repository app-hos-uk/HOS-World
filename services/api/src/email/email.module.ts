import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MessagingModule } from '../messaging/messaging.module';
import { QueueModule } from '../queue/queue.module';
import { TemplatesModule } from '../templates/templates.module';
import { AdminEmailController } from './admin-email.controller';
import { AdminEmailJobsService } from './admin-email.jobs';
import { AdminEmailService } from './admin-email.service';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, MessagingModule, TemplatesModule],
  controllers: [AdminEmailController],
  providers: [AdminEmailService, AdminEmailJobsService],
  exports: [AdminEmailService],
})
export class EmailModule {}
