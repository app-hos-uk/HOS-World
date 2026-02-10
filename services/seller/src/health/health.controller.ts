import { Controller, Get } from '@nestjs/common';
import { SellerPrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  constructor(private prisma: SellerPrismaService) {}

  @Get()
  async health() {
    const db = await this.prisma.healthCheck();
    return { status: db ? 'ok' : 'degraded', service: 'seller-service', uptime: Math.floor((Date.now() - this.startTime) / 1000) };
  }

  @Get('live')
  liveness() { return { status: 'ok' }; }

  @Get('ready')
  async readiness() {
    const db = await this.prisma.healthCheck();
    return { status: db ? 'ok' : 'not_ready' };
  }
}
