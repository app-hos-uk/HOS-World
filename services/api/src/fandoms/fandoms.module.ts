import { Module } from '@nestjs/common';
import { FandomsController } from './fandoms.controller';
import { FandomsService } from './fandoms.service';

@Module({
  controllers: [FandomsController],
  providers: [FandomsService],
  exports: [FandomsService],
})
export class FandomsModule {}
