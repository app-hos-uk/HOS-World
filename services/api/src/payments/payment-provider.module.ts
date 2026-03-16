import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentProviderService } from './payment-provider.service';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [ConfigModule],
  providers: [PaymentProviderService, StripeProvider],
  exports: [PaymentProviderService, StripeProvider],
})
export class PaymentProviderModule {}
