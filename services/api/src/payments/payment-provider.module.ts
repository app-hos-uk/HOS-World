import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentProviderService } from './payment-provider.service';
import { StripeProvider } from './providers/stripe.provider';
import { KlarnaProvider } from './providers/klarna.provider';

@Module({
  imports: [ConfigModule],
  providers: [PaymentProviderService, StripeProvider, KlarnaProvider],
  exports: [PaymentProviderService, StripeProvider, KlarnaProvider],
})
export class PaymentProviderModule {}
