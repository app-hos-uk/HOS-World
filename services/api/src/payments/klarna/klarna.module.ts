import { Module } from '@nestjs/common';
import { KlarnaController } from './klarna.controller';
import { KlarnaService } from './klarna.service';
import { DatabaseModule } from '../../database/database.module';
import { CurrencyModule } from '../../currency/currency.module';

@Module({
  imports: [DatabaseModule, CurrencyModule],
  controllers: [KlarnaController],
  providers: [KlarnaService],
  exports: [KlarnaService],
})
export class KlarnaModule {}
