import { Injectable, Logger } from '@nestjs/common';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold?: number;
  /** Time in ms before attempting half-open */
  resetTimeoutMs?: number;
  /** Number of successes in half-open needed to close */
  halfOpenSuccessCount?: number;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenSuccessCount: 2,
};

interface ServiceCircuit {
  state: CircuitState;
  failures: number;
  halfOpenSuccesses: number;
  lastFailureTime: number;
  lastStateChange: number;
}

/**
 * Circuit Breaker Service
 *
 * Tracks per-service failure state. When a service exceeds the failure threshold,
 * the circuit opens and the gateway returns 503 immediately without calling the
 * downstream service. After resetTimeoutMs, one request is allowed (half-open);
 * on success the circuit closes, on failure it reopens.
 *
 * Configure via env:
 *   CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
 *   CIRCUIT_BREAKER_RESET_TIMEOUT_MS=30000
 *   CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_COUNT=2
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, ServiceCircuit>();
  private readonly options: Required<CircuitBreakerOptions>;

  constructor() {
    this.options = {
      failureThreshold:
        parseInt(
          process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '',
          10,
        ) || DEFAULT_OPTIONS.failureThreshold,
      resetTimeoutMs:
        parseInt(
          process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS || '',
          10,
        ) || DEFAULT_OPTIONS.resetTimeoutMs,
      halfOpenSuccessCount:
        parseInt(
          process.env.CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_COUNT || '',
          10,
        ) || DEFAULT_OPTIONS.halfOpenSuccessCount,
    };
    this.logger.log(
      `Circuit breaker: threshold=${this.options.failureThreshold}, ` +
        `resetTimeout=${this.options.resetTimeoutMs}ms`,
    );
  }

  /**
   * Returns true if the request is allowed to proceed to the service.
   * When circuit is open, returns false (caller should respond 503).
   * When half-open, allows one request through.
   */
  allowRequest(serviceName: string): boolean {
    const c = this.getOrCreateCircuit(serviceName);

    if (c.state === 'closed') {
      return true;
    }

    if (c.state === 'open') {
      if (Date.now() - c.lastStateChange >= this.options.resetTimeoutMs) {
        c.state = 'half_open';
        c.halfOpenSuccesses = 0;
        c.lastStateChange = Date.now();
        this.logger.warn(`[${serviceName}] Circuit half-open (allowing probe)`);
        return true;
      }
      return false;
    }

    // half_open: allow the probe request
    return true;
  }

  /** Call when the downstream request succeeded */
  recordSuccess(serviceName: string): void {
    const c = this.getOrCreateCircuit(serviceName);

    if (c.state === 'half_open') {
      c.halfOpenSuccesses++;
      if (c.halfOpenSuccesses >= this.options.halfOpenSuccessCount) {
        c.state = 'closed';
        c.failures = 0;
        c.lastStateChange = Date.now();
        this.logger.log(`[${serviceName}] Circuit closed (recovered)`);
      }
    } else if (c.state === 'closed') {
      c.failures = 0;
    }
  }

  /** Call when the downstream request failed (5xx, timeout, connection error) */
  recordFailure(serviceName: string): void {
    const c = this.getOrCreateCircuit(serviceName);

    if (c.state === 'half_open') {
      c.state = 'open';
      c.lastStateChange = Date.now();
      c.lastFailureTime = Date.now();
      this.logger.warn(`[${serviceName}] Circuit reopened (half-open failed)`);
      return;
    }

    c.failures++;
    c.lastFailureTime = Date.now();

    if (c.failures >= this.options.failureThreshold) {
      c.state = 'open';
      c.lastStateChange = Date.now();
      this.logger.warn(
        `[${serviceName}] Circuit open after ${c.failures} failures`,
      );
    }
  }

  getState(serviceName: string): CircuitState {
    return this.getOrCreateCircuit(serviceName).state;
  }

  /** For admin/metrics: return all circuit states */
  getAllStates(): Record<string, { state: CircuitState; failures: number }> {
    const out: Record<string, { state: CircuitState; failures: number }> = {};
    for (const [name, c] of this.circuits) {
      out[name] = { state: c.state, failures: c.failures };
    }
    return out;
  }

  private getOrCreateCircuit(serviceName: string): ServiceCircuit {
    let c = this.circuits.get(serviceName);
    if (!c) {
      c = {
        state: 'closed',
        failures: 0,
        halfOpenSuccesses: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
      };
      this.circuits.set(serviceName, c);
    }
    return c;
  }
}
