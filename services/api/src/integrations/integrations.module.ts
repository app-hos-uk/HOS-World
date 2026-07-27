import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { EncryptionService } from './encryption.service';
import { DatabaseModule } from '../database/database.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';

/**
 * IntegrationsModule - Manages third-party integration configurations
 *
 * This module is marked as @Global so that IntegrationsService and EncryptionService
 * can be injected into other modules (e.g., shipping, tax) without explicit imports.
 *
 * PaymentProviderModule is imported so IntegrationsController can reload StripeProvider
 * when Stripe credentials are created/updated/activated (without requiring an API restart).
 */
@Global()
@Module({
  imports: [DatabaseModule, ConfigModule, forwardRef(() => PaymentProviderModule)],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, EncryptionService],
  exports: [IntegrationsService, EncryptionService],
})
export class IntegrationsModule {}
