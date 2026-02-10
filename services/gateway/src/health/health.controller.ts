import { Controller, Get, Logger } from '@nestjs/common';
import { getServiceConfigs } from '../config/services.config';
import { CircuitBreakerService } from '../proxy/circuit-breaker.service';

/**
 * Health Controller
 *
 * Provides health check endpoints for the gateway itself
 * and aggregated health status of downstream services.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'gateway',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  readiness() {
    return { status: 'ok' };
  }

  @Get('services')
  services() {
    const configs = getServiceConfigs();
    return {
      services: configs.map((svc) => ({
        name: svc.name,
        url: svc.url,
        enabled: svc.enabled,
        prefixes: svc.prefixes,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /** Circuit breaker state per service (for observability dashboards) */
  @Get('circuits')
  circuits() {
    return {
      circuits: this.circuitBreaker.getAllStates(),
      timestamp: new Date().toISOString(),
    };
  }
}
