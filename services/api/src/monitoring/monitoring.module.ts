import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { LoggerService } from './logger.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [MonitoringService, MetricsService, LoggerService],
  exports: [MonitoringService, MetricsService, LoggerService],
})
export class MonitoringModule {}
