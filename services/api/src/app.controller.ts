import { Controller, Get, Optional, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    @Optional() @Inject(ElasticsearchService) private readonly elasticsearch?: ElasticsearchService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get API information' })
  @SwaggerApiResponse({ status: 200, description: 'API information retrieved successfully' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint', description: 'Returns the health status of the API and all dependencies' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Health check completed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-01-07T12:00:00.000Z' },
        service: { type: 'string', example: 'House of Spells Marketplace API' },
        checks: {
          type: 'object',
          properties: {
            service: { type: 'object' },
            database: { type: 'object' },
            redis: { type: 'object' },
            elasticsearch: { type: 'object' },
          },
        },
      },
    },
  })
  async healthCheck() {
    const checks: Record<string, { status: string; message?: string }> = {
      service: {
        status: 'ok',
        message: 'House of Spells Marketplace API',
      },
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok' };
    } catch (error: any) {
      checks.database = {
        status: 'error',
        message: error.message || 'Database connection failed',
      };
    }

    // Check Redis
    try {
      const isConnected = this.redis.isRedisConnected();
      checks.redis = {
        status: isConnected ? 'ok' : 'degraded',
        message: isConnected ? 'Connected' : 'Not connected (using fallback)',
      };
    } catch (error: any) {
      checks.redis = {
        status: 'error',
        message: error.message || 'Redis check failed',
      };
    }

    // Check Elasticsearch (if configured)
    const elasticsearchNode = this.configService.get('ELASTICSEARCH_NODE');
    if (elasticsearchNode && this.elasticsearch) {
      try {
        const health = await this.elasticsearch.ping();
        checks.elasticsearch = {
          status: health ? 'ok' : 'error',
          message: health ? 'Connected' : 'Ping failed',
        };
      } catch (error: any) {
        checks.elasticsearch = {
          status: 'error',
          message: error.message || 'Elasticsearch connection failed',
        };
      }
    } else {
      checks.elasticsearch = {
        status: 'disabled',
        message: 'Elasticsearch not configured',
      };
    }

    const allHealthy = Object.values(checks).every(
      (check) => check.status === 'ok' || check.status === 'disabled',
    );
    const hasErrors = Object.values(checks).some((check) => check.status === 'error');

    return {
      status: hasErrors ? 'error' : allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'House of Spells Marketplace API',
      checks,
    };
  }
}


