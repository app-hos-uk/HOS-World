import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DatabaseModule } from '../database/database.module';
import { CurrencyModule } from '../currency/currency.module';
import { PaymentProviderModule } from './payment-provider.module';

@Module({
  imports: [DatabaseModule, CurrencyModule, PaymentProviderModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, PaymentProviderModule],
})
export class PaymentsModule {}
