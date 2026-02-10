import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthPrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(private prisma: AuthPrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service healthy' })
  async health() {
    const dbHealthy = await this.prisma.healthCheck();
    return {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'auth-service',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: { database: dbHealthy ? 'ok' : 'error' },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async readiness() {
    const dbHealthy = await this.prisma.healthCheck();
    if (!dbHealthy) return { status: 'not_ready', reason: 'database unavailable' };
    return { status: 'ok' };
  }
}
