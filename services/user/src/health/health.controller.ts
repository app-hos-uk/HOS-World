import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserPrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  constructor(private prisma: UserPrismaService) {}

  @Get()
  async health() {
    const dbHealthy = await this.prisma.healthCheck();
    return { status: dbHealthy ? 'ok' : 'degraded', service: 'user-service', uptime: Math.floor((Date.now() - this.startTime) / 1000) };
  }

  @Get('live')
  liveness() { return { status: 'ok' }; }

  @Get('ready')
  async readiness() {
    const db = await this.prisma.healthCheck();
    return db ? { status: 'ok' } : { status: 'not_ready', reason: 'database unavailable' };
  }
}
