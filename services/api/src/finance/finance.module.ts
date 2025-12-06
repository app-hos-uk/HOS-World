import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    FinanceController,
    TransactionsController,
    PayoutsController,
    RefundsController,
    ReportsController,
  ],
  providers: [
    FinanceService,
    TransactionsService,
    PayoutsService,
    RefundsService,
    ReportsService,
  ],
  exports: [
    FinanceService,
    TransactionsService,
    PayoutsService,
    RefundsService,
    ReportsService,
  ],
})
export class FinanceModule {}

