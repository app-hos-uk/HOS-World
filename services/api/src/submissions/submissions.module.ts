import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { DatabaseModule } from '../database/database.module';
import { UploadsModule } from '../uploads/uploads.module';
import { DuplicatesModule } from '../duplicates/duplicates.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [DatabaseModule, UploadsModule, DuplicatesModule, CacheModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}

