import { Global, Module } from '@nestjs/common';
import { ContentPrismaService } from './prisma.service';

@Global()
@Module({ providers: [ContentPrismaService], exports: [ContentPrismaService] })
export class DatabaseModule {}
