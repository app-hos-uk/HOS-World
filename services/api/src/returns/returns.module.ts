import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnsEnhancementsService } from './returns-enhancements.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsEnhancementsService],
  exports: [ReturnsService, ReturnsEnhancementsService],
})
export class ReturnsModule {}


