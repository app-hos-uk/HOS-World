import { Module } from '@nestjs/common';
import { ReturnPoliciesController } from './return-policies.controller';
import { ReturnPoliciesService } from './return-policies.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ReturnPoliciesController],
  providers: [ReturnPoliciesService],
  exports: [ReturnPoliciesService],
})
export class ReturnPoliciesModule {}
