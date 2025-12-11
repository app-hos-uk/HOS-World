import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  async health() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
    };

    // Check database connection (non-blocking)
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'connected';
    } catch (error) {
      checks.services.database = 'disconnected';
      checks.status = 'degraded';
    }

    // Check Redis connection (non-blocking)
    try {
      if (this.redis.isConnected()) {
        checks.services.redis = 'connected';
      } else {
        checks.services.redis = 'disconnected';
        // Redis is optional, so don't mark as degraded
      }
    } catch (error) {
      checks.services.redis = 'disconnected';
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return checks;
  }

  @Get('ready')
  async readiness() {
    // Readiness check - requires database to be connected
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Database not connected',
      };
    }
  }

  @Get('live')
  async liveness() {
    // Liveness check - just confirms app is running
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

