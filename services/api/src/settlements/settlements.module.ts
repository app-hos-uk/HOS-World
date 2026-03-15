import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { SettlementSchedulerService } from './settlement-scheduler.service';
import { DatabaseModule } from '../database/database.module';
import { CurrencyModule } from '../currency/currency.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [DatabaseModule, CurrencyModule, PaymentsModule],
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementSchedulerService],
  exports: [SettlementsService, SettlementSchedulerService],
})
export class SettlementsModule {}
