import { Module } from '@nestjs/common';
import { VendorLedgerController } from './vendor-ledger.controller';
import { VendorLedgerService } from './vendor-ledger.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VendorLedgerController],
  providers: [VendorLedgerService],
  exports: [VendorLedgerService],
})
export class VendorLedgerModule {}
