import { Global, Module } from '@nestjs/common';
import { SearchPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [SearchPrismaService],
  exports: [SearchPrismaService],
})
export class DatabaseModule {}
