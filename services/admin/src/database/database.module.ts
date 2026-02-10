import { Global, Module } from '@nestjs/common';
import { AdminPrismaService } from './prisma.service';

@Global()
@Module({ providers: [AdminPrismaService], exports: [AdminPrismaService] })
export class DatabaseModule {}
