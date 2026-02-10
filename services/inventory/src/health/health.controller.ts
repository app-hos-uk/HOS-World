import { Controller, Get } from '@nestjs/common';
import { InventoryPrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private prisma: InventoryPrismaService) {}

  @Get()
  async health() {
    const dbHealthy = await this.prisma.healthCheck();
    return {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'inventory-service',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness() {
    const dbHealthy = await this.prisma.healthCheck();
    return { status: dbHealthy ? 'ok' : 'not_ready' };
  }
}
