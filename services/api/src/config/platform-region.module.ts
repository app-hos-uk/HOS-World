import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PlatformRegionService } from './platform-region.service';

/**
 * PlatformRegionModule - Single source of truth for platform currency/country/locale/timezone.
 *
 * Marked @Global so PlatformRegionService can be injected anywhere without explicit imports
 * (same pattern as FeatureFlagsModule / IntegrationsModule).
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [PlatformRegionService],
  exports: [PlatformRegionService],
})
export class PlatformRegionModule {}
