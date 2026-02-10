import { Module } from '@nestjs/common';
import { CustomerGroupsService } from './customer-groups.service';
import { CustomerGroupsController } from './customer-groups.controller';

@Module({
  controllers: [CustomerGroupsController],
  providers: [CustomerGroupsService],
  exports: [CustomerGroupsService],
})
export class CustomerGroupsModule {}
