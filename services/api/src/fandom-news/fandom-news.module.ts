import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { FandomNewsService } from './fandom-news.service';
import {
  FandomNewsAdminController,
  FandomNewsController,
  FandomWorldController,
} from './fandom-news.controller';
import { FandomNewsProcessor } from './jobs/fandom-news.processor';

@Module({
  imports: [DatabaseModule, QueueModule, ConfigModule],
  controllers: [FandomNewsController, FandomWorldController, FandomNewsAdminController],
  providers: [FandomNewsService, FandomNewsProcessor],
  exports: [FandomNewsService],
})
export class FandomNewsModule {}
