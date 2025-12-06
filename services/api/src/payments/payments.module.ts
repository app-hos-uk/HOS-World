import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DatabaseModule } from '../database/database.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [DatabaseModule, CurrencyModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}


