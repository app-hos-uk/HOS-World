import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantContextService } from './tenant-context.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantContextService],
  exports: [TenantsService, TenantContextService],
})
export class TenantsModule {}
