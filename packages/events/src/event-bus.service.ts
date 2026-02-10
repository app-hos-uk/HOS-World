import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { DomainEvent, EventPattern } from './events';
import { EVENT_BUS_CLIENT } from './event-bus.module';

/**
 * EventBusService
 *
 * Wraps the NestJS ClientProxy to provide a typed, convenient API for
 * emitting domain events. Each event is automatically enriched with:
 * - Unique eventId
 * - Timestamp
 * - Source service name
 * - Optional correlationId and tenantId
 */
@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @Inject(EVENT_BUS_CLIENT) private readonly client: ClientProxy,
    @Inject('EVENT_BUS_SERVICE_NAME') private readonly serviceName: string,
  ) {}

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log(`EventBus connected for service: ${this.serviceName}`);
    } catch (error: any) {
      this.logger.warn(
        `EventBus connection deferred (Redis may not be ready): ${error?.message}`,
      );
    }
  }

  /**
   * Emit a domain event to the event bus.
   *
   * @param pattern - The event pattern (e.g., 'order.order.created')
   * @param payload - The typed event payload
   * @param options - Optional correlation ID and tenant ID
   */
  emit<T>(
    pattern: EventPattern | string,
    payload: T,
    options?: { correlationId?: string; tenantId?: string },
  ): void {
    const event: DomainEvent<T> = {
      eventId: randomUUID(),
      pattern,
      timestamp: new Date().toISOString(),
      source: this.serviceName,
      tenantId: options?.tenantId,
      correlationId: options?.correlationId,
      payload,
    };

    try {
      this.client.emit(pattern, event);
      this.logger.debug(
        `Event emitted: ${pattern} [${event.eventId}]`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to emit event ${pattern}: ${error?.message}`,
        error?.stack,
      );
    }
  }

  /**
   * Send a command (request-response) to another service.
   * Use this when you need a response back (synchronous inter-service call).
   *
   * @param pattern - The message pattern
   * @param data - The request payload
   * @returns Observable of the response
   */
  send<TResult = any, TInput = any>(pattern: string, data: TInput) {
    return this.client.send<TResult, TInput>(pattern, data);
  }
}
