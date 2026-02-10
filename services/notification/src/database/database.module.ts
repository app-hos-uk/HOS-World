import { Global, Module } from '@nestjs/common';
import { NotificationPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [NotificationPrismaService],
  exports: [NotificationPrismaService],
})
export class DatabaseModule {}
