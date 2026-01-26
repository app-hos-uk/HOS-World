import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { EncryptionService } from './encryption.service';
import { DatabaseModule } from '../database/database.module';

/**
 * IntegrationsModule - Manages third-party integration configurations
 * 
 * This module is marked as @Global so that IntegrationsService and EncryptionService
 * can be injected into other modules (e.g., shipping, tax) without explicit imports.
 */
@Global()
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, EncryptionService],
  exports: [IntegrationsService, EncryptionService],
})
export class IntegrationsModule {}
