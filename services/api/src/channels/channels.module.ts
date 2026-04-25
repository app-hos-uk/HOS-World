import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CurrencyModule } from '../currency/currency.module';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';

@Module({
  imports: [DatabaseModule, CurrencyModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
