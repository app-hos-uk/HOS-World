import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DatabaseModule } from '../database/database.module';
import { CurrencyModule } from '../currency/currency.module';
import { PaymentProviderModule } from './payment-provider.module';
import { StripeConnectService } from './stripe-connect/stripe-connect.service';
import { StripeConnectController } from './stripe-connect/stripe-connect.controller';
import { VendorLedgerModule } from '../vendor-ledger/vendor-ledger.module';

@Module({
  imports: [DatabaseModule, CurrencyModule, PaymentProviderModule, VendorLedgerModule],
  controllers: [PaymentsController, StripeConnectController],
  providers: [PaymentsService, StripeConnectService],
  exports: [PaymentsService, PaymentProviderModule, StripeConnectService],
})
export class PaymentsModule {}
