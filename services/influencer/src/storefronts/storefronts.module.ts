import { Module } from '@nestjs/common';
import { StorefrontsController } from './storefronts.controller';
import { StorefrontsService } from './storefronts.service';

@Module({
  controllers: [StorefrontsController],
  providers: [StorefrontsService],
  exports: [StorefrontsService],
})
export class StorefrontsModule {}
