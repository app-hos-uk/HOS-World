import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EventHandlersController } from './event-handlers.controller';

@Module({
  controllers: [NotificationController, EventHandlersController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
