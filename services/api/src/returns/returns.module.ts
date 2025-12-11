import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnsEnhancementsService } from './returns-enhancements.service';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FinanceModule, NotificationsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsEnhancementsService],
  exports: [ReturnsService, ReturnsEnhancementsService],
})
export class ReturnsModule {}


