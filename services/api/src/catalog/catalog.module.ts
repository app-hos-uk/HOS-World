import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { DatabaseModule } from '../database/database.module';
import { UploadsModule } from '../uploads/uploads.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, UploadsModule, NotificationsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

