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
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { PeriodCloseController } from './period-close.controller';
import { PeriodCloseService } from './period-close.service';
import { AgingController } from './aging.controller';
import { AgingService } from './aging.service';
import { RevenueRecognitionController } from './revenue-recognition.controller';
import { RevenueRecognitionService } from './revenue-recognition.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';
import { VendorLedgerModule } from '../vendor-ledger/vendor-ledger.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, PaymentProviderModule, VendorLedgerModule],
  controllers: [
    FinanceController,
    TransactionsController,
    PayoutsController,
    RefundsController,
    ReportsController,
    ReconciliationController,
    DisputesController,
    PeriodCloseController,
    AgingController,
    RevenueRecognitionController,
  ],
  providers: [
    FinanceService,
    TransactionsService,
    PayoutsService,
    RefundsService,
    ReportsService,
    ReconciliationService,
    DisputesService,
    PeriodCloseService,
    AgingService,
    RevenueRecognitionService,
  ],
  exports: [
    FinanceService,
    TransactionsService,
    PayoutsService,
    RefundsService,
    ReportsService,
    ReconciliationService,
    DisputesService,
    PeriodCloseService,
    AgingService,
    RevenueRecognitionService,
  ],
})
export class FinanceModule {}
