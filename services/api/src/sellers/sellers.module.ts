import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [DatabaseModule, ConfigModule, ActivityModule, forwardRef(() => NotificationsModule), TemplatesModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
