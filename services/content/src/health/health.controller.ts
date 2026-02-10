import { Controller, Get } from '@nestjs/common';
import { ContentPrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  constructor(private prisma: ContentPrismaService) {}

  @Get() async health() { const db = await this.prisma.healthCheck(); return { status: db ? 'ok' : 'degraded', service: 'content-service', uptime: Math.floor((Date.now() - this.startTime) / 1000) }; }
  @Get('live') liveness() { return { status: 'ok' }; }
  @Get('ready') async readiness() { return { status: (await this.prisma.healthCheck()) ? 'ok' : 'not_ready' }; }
}
