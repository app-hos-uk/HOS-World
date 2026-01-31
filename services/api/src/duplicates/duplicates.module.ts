import { Module } from '@nestjs/common';
import { DuplicatesService } from './duplicates.service';
import { DuplicatesController } from './duplicates.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DuplicatesController],
  providers: [DuplicatesService],
  exports: [DuplicatesService],
})
export class DuplicatesModule {}
