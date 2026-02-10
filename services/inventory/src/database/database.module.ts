import { Global, Module } from '@nestjs/common';
import { InventoryPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [InventoryPrismaService],
  exports: [InventoryPrismaService],
})
export class DatabaseModule {}
