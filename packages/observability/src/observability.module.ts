import { Global, Module, DynamicModule } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { MonitoringService } from './monitoring.service';

export interface ObservabilityModuleOptions {
  /** Name of the microservice (used in logs and metrics) */
  serviceName: string;
}

/**
 * Observability Module
 *
 * Provides LoggerService and MonitoringService pre-configured
 * with the service name. Import in each microservice's root module:
 *
 *   ObservabilityModule.register({ serviceName: 'order-service' })
 */
@Global()
@Module({})
export class ObservabilityModule {
  static register(options: ObservabilityModuleOptions): DynamicModule {
    return {
      module: ObservabilityModule,
      providers: [
        {
          provide: LoggerService,
          useFactory: () => new LoggerService(options.serviceName),
        },
        {
          provide: MonitoringService,
          useFactory: () => new MonitoringService(options.serviceName),
        },
      ],
      exports: [LoggerService, MonitoringService],
    };
  }
}
