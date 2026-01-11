import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule, // Ensure ConfigModule is available (though it's global, explicit is safer)
    StorageModule, // For Cloudinary upload signatures
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}

