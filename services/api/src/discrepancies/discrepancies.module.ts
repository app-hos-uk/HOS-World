import { Module } from '@nestjs/common';
import { DiscrepanciesController } from './discrepancies.controller';
import { DiscrepanciesService } from './discrepancies.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DiscrepanciesController],
  providers: [DiscrepanciesService],
  exports: [DiscrepanciesService],
})
export class DiscrepanciesModule {}
