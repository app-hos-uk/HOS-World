import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly logger: Logger;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      name: options.name,
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30000,
      halfOpenMaxAttempts: options.halfOpenMaxAttempts ?? 1,
    };
    this.logger = new Logger(`CircuitBreaker(${this.options.name})`);
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        this.logger.log(`Transitioning to HALF_OPEN after reset timeout`);
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      this.logger.warn('Circuit is OPEN - rejecting request');
      throw new Error('Circuit open');
    }

    if (currentState === CircuitState.HALF_OPEN) {
      if (this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        this.logger.warn('HALF_OPEN max attempts reached - rejecting request');
        throw new Error('Circuit open');
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.halfOpenAttempts = 0;
      this.logger.log('Recovered - transitioned to CLOSED');
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn('Failure in HALF_OPEN - transitioned to OPEN');
      return;
    }

    this.failures++;
    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.warn(
        `Failure threshold (${this.options.failureThreshold}) reached - circuit OPEN`,
      );
    }
  }
}
