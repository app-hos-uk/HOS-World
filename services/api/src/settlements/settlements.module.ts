import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { DatabaseModule } from '../database/database.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [DatabaseModule, CurrencyModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}



