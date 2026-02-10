import { Global, Module } from '@nestjs/common';
import { UserPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [UserPrismaService],
  exports: [UserPrismaService],
})
export class DatabaseModule {}
