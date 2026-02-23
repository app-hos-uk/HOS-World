import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    ConfigModule,
    StorageModule,
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
