import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { StorageModule } from '../storage/storage.module';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    DatabaseModule,
    QueueModule,
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
