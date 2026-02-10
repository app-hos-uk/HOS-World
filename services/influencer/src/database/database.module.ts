import { Global, Module } from '@nestjs/common';
import { InfluencerPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [InfluencerPrismaService],
  exports: [InfluencerPrismaService],
})
export class DatabaseModule {}
