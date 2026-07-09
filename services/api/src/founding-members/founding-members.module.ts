import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FoundingMembersController } from './founding-members.controller';
import { FoundingMembersService } from './founding-members.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeatureFlagsModule } from '../config/feature-flags.module';

@Module({
  imports: [ConfigModule, FeatureFlagsModule, DatabaseModule, NotificationsModule],
  controllers: [FoundingMembersController],
  providers: [FoundingMembersService],
  exports: [FoundingMembersService],
})
export class FoundingMembersModule {}
