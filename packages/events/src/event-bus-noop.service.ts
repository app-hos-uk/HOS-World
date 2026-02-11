import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable, of } from 'rxjs';

/**
 * No-op EventBusService used when REDIS_URL is not configured.
 * Allows services to start without Redis; events are not emitted.
 */
@Injectable()
export class EventBusNoOpService implements OnModuleInit {
  private readonly logger = new Logger(EventBusNoOpService.name);

  async onModuleInit() {
    this.logger.warn('EventBus running in no-op mode (REDIS_URL not set). Events will not be emitted.');
  }

  emit<T>(_pattern: string, _payload: T, _options?: { correlationId?: string; tenantId?: string }): void {
    // no-op
  }

  send<TResult = any, TInput = any>(_pattern: string, _data: TInput): Observable<TResult> {
    return of(undefined as TResult);
  }
}
