import { Global, Module } from '@nestjs/common';
import { PaymentPrismaService } from './prisma.service';

@Global()
@Module({ providers: [PaymentPrismaService], exports: [PaymentPrismaService] })
export class DatabaseModule {}
