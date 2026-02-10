import { Global, Module } from '@nestjs/common';
import { OrderPrismaService } from './prisma.service';

@Global()
@Module({ providers: [OrderPrismaService], exports: [OrderPrismaService] })
export class DatabaseModule {}
