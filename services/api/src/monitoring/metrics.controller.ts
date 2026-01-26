import { Controller, Get, Header Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { MonitoringService } from './monitoring.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('monitoring')
@Version('1')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly monitoringService: MonitoringService,
  ) {}

  @Public()
  @Get('prometheus')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns metrics in Prometheus format for scraping. Public endpoint for monitoring systems.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Metrics in Prometheus format' })
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getPrometheusMetrics(): string {
    return this.metricsService.getPrometheusMetrics();
  }

  @Public()
  @Get('json')
  @ApiOperation({
    summary: 'Get metrics as JSON',
    description: 'Returns metrics in JSON format. Public endpoint for monitoring systems.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Metrics in JSON format' })
  getMetricsJSON() {
    return {
      metrics: this.metricsService.getMetricsJSON(),
      monitoring: this.monitoringService.getMetrics(),
    };
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Get monitoring health status',
    description: 'Returns health status of monitoring systems. Public endpoint.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Monitoring health status' })
  getHealth() {
    const metrics = this.metricsService.getMetricsJSON();
    const monitoring = this.monitoringService.getMetrics();

    return {
      status: 'healthy',
      metrics: {
        enabled: true,
        counters: Object.keys(metrics.counters).length,
        gauges: Object.keys(metrics.gauges).length,
        histograms: Object.keys(metrics.histograms).length,
      },
      monitoring: {
        enabled: true,
        uptime: monitoring.uptime,
        requests: monitoring.requests.total,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
