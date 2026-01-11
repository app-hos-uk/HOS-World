import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Metrics Service
 * 
 * Provides Prometheus-compatible metrics endpoint.
 * Collects application metrics for monitoring and alerting.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.logger.log('Metrics service initialized');
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics() {
    // HTTP metrics
    this.createCounter('http_requests_total', 'Total number of HTTP requests');
    this.createCounter('http_errors_total', 'Total number of HTTP errors');
    
    // Database metrics
    this.createCounter('db_queries_total', 'Total number of database queries');
    this.createCounter('db_errors_total', 'Total number of database errors');
    this.createHistogram('db_query_duration_seconds', 'Database query duration');
    
    // Cache metrics
    this.createCounter('cache_hits_total', 'Total number of cache hits');
    this.createCounter('cache_misses_total', 'Total number of cache misses');
    
    // Queue metrics
    this.createCounter('queue_jobs_total', 'Total number of queue jobs');
    this.createCounter('queue_jobs_failed_total', 'Total number of failed queue jobs');
    this.createHistogram('queue_job_duration_seconds', 'Queue job processing duration');
  }

  /**
   * Create a counter metric
   */
  createCounter(name: string, help: string) {
    this.counters.set(name, 0);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Create a gauge metric
   */
  setGauge(name: string, value: number) {
    this.metrics.set(name, value);
  }

  /**
   * Create a histogram
   */
  createHistogram(name: string, help: string) {
    this.histograms.set(name, []);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number) {
    const values = this.histograms.get(name) || [];
    values.push(value);
    // Keep only last 1000 values to prevent memory issues
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(name, values);
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string) {
    const values = this.histograms.get(name) || [];
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      count: values.length,
      sum,
      avg: parseFloat(avg.toFixed(3)),
      min,
      max,
      p50,
      p95,
      p99,
    };
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Counters
    for (const [name, value] of this.counters.entries()) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    
    // Gauges
    for (const [name, value] of this.metrics.entries()) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    
    // Histograms
    for (const [name, values] of this.histograms.entries()) {
      const stats = this.getHistogramStats(name);
      if (stats) {
        lines.push(`# TYPE ${name} histogram`);
        lines.push(`${name}_count ${stats.count}`);
        lines.push(`${name}_sum ${stats.sum}`);
        lines.push(`${name}_avg ${stats.avg}`);
        lines.push(`${name}_min ${stats.min}`);
        lines.push(`${name}_max ${stats.max}`);
        lines.push(`${name}_p50 ${stats.p50}`);
        lines.push(`${name}_p95 ${stats.p95}`);
        lines.push(`${name}_p99 ${stats.p99}`);
      }
    }
    
    // System metrics
    const memUsage = process.memoryUsage();
    lines.push('# TYPE nodejs_memory_heap_used_bytes gauge');
    lines.push(`nodejs_memory_heap_used_bytes ${memUsage.heapUsed}`);
    lines.push('# TYPE nodejs_memory_heap_total_bytes gauge');
    lines.push(`nodejs_memory_heap_total_bytes ${memUsage.heapTotal}`);
    lines.push('# TYPE nodejs_memory_rss_bytes gauge');
    lines.push(`nodejs_memory_rss_bytes ${memUsage.rss}`);
    
    return lines.join('\n') + '\n';
  }

  /**
   * Get metrics as JSON
   */
  getMetricsJSON() {
    const counters: Record<string, number> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, any> = {};

    for (const [name, value] of this.counters.entries()) {
      counters[name] = value;
    }

    for (const [name, value] of this.metrics.entries()) {
      gauges[name] = value;
    }

    for (const [name] of this.histograms.entries()) {
      histograms[name] = this.getHistogramStats(name);
    }

    return {
      counters,
      gauges,
      histograms,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics.clear();
    this.counters.clear();
    this.histograms.clear();
    this.initializeDefaultMetrics();
  }
}
