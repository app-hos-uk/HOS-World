import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../database/prisma.service';

export interface ErrorCacheEntry {
  errorKey: string;
  errorType: string;
  message: string;
  context?: Record<string, any>;
  count: number;
  firstOccurred: Date;
  lastOccurred: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastOccurred: Date;
}

@Injectable()
export class ErrorCacheService {
  private readonly logger = new Logger(ErrorCacheService.name);
  private readonly ERROR_CACHE_PREFIX = 'error:';
  private readonly ERROR_PATTERN_PREFIX = 'error_pattern:';
  private readonly ERROR_COUNT_PREFIX = 'error_count:';
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly CRITICAL_TTL = 86400; // 24 hours for critical errors
  private readonly MAX_ERROR_COUNT = 100; // Maximum errors to cache per key

  constructor(
    private cacheService: CacheService,
    private prisma: PrismaService,
  ) {}

  /**
   * Cache an error with context
   */
  async cacheError(
    errorKey: string,
    error: Error | string,
    context?: Record<string, any>,
    ttl?: number,
  ): Promise<ErrorCacheEntry> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    const now = new Date();

    // Get existing error entry
    const existing = await this.getError(errorKey);

    let entry: ErrorCacheEntry;
    if (existing) {
      // Update existing entry
      entry = {
        ...existing,
        count: existing.count + 1,
        lastOccurred: now,
        context: { ...existing.context, ...context },
      };
    } else {
      // Create new entry
      entry = {
        errorKey,
        errorType,
        message: errorMessage,
        context,
        count: 1,
        firstOccurred: now,
        lastOccurred: now,
        resolved: false,
      };
    }

    // Cache the error entry
    const cacheKey = `${this.ERROR_CACHE_PREFIX}${errorKey}`;
    const cacheTtl = ttl || this.getTtlForErrorType(errorType);
    await this.cacheService.set(cacheKey, entry, cacheTtl);

    // Track error pattern
    await this.trackErrorPattern(errorType, errorMessage);

    // Increment error count
    await this.incrementErrorCount(errorKey);

    // Log if error count exceeds threshold
    if (entry.count >= 10) {
      this.logger.warn(
        `Error "${errorKey}" has occurred ${entry.count} times. Last: ${errorMessage}`,
      );
    }

    return entry;
  }

  /**
   * Get cached error entry
   */
  async getError(errorKey: string): Promise<ErrorCacheEntry | null> {
    const cacheKey = `${this.ERROR_CACHE_PREFIX}${errorKey}`;
    return (await this.cacheService.get<ErrorCacheEntry>(cacheKey)) || null;
  }

  /**
   * Check if error should be retried (not cached as permanent failure)
   */
  async shouldRetry(errorKey: string, maxRetries: number = 3): Promise<boolean> {
    const entry = await this.getError(errorKey);
    if (!entry) {
      return true; // No cached error, allow retry
    }

    // Don't retry if error is marked as resolved
    if (entry.resolved) {
      return true;
    }

    // Don't retry if error count exceeds max retries
    if (entry.count >= maxRetries) {
      return false;
    }

    // Allow retry if error is old enough (cache expired or TTL passed)
    const cacheKey = `${this.ERROR_CACHE_PREFIX}${errorKey}`;
    const cached = await this.cacheService.get<ErrorCacheEntry>(cacheKey);
    return cached === null; // Cache expired, allow retry
  }

  /**
   * Mark error as resolved
   */
  async resolveError(errorKey: string): Promise<void> {
    const entry = await this.getError(errorKey);
    if (entry) {
      entry.resolved = true;
      entry.resolvedAt = new Date();
      const cacheKey = `${this.ERROR_CACHE_PREFIX}${errorKey}`;
      await this.cacheService.set(cacheKey, entry, this.DEFAULT_TTL);
      this.logger.log(`Error "${errorKey}" marked as resolved`);
    }
  }

  /**
   * Get error count for a specific key
   */
  async getErrorCount(errorKey: string): Promise<number> {
    const countKey = `${this.ERROR_COUNT_PREFIX}${errorKey}`;
    const count = await this.cacheService.get<number>(countKey);
    return count || 0;
  }

  /**
   * Get error patterns (grouped by error type)
   */
  async getErrorPatterns(limit: number = 20): Promise<ErrorPattern[]> {
    // This would ideally query from database, but for now use cache
    const patterns: ErrorPattern[] = [];
    
    // In a real implementation, you'd query from database or aggregate from cache
    // For now, return empty array - can be enhanced with database storage
    
    return patterns;
  }

  /**
   * Track error pattern for analytics
   */
  private async trackErrorPattern(errorType: string, message: string): Promise<void> {
    const patternKey = `${this.ERROR_PATTERN_PREFIX}${errorType}`;
    const existing = await this.cacheService.get<ErrorPattern>(patternKey);

    const pattern: ErrorPattern = existing || {
      pattern: errorType,
      count: 0,
      severity: this.getSeverityForErrorType(errorType),
      lastOccurred: new Date(),
    };

    pattern.count += 1;
    pattern.lastOccurred = new Date();

    await this.cacheService.set(patternKey, pattern, this.CRITICAL_TTL);
  }

  /**
   * Increment error count
   */
  private async incrementErrorCount(errorKey: string): Promise<void> {
    const countKey = `${this.ERROR_COUNT_PREFIX}${errorKey}`;
    const currentCount = await this.getErrorCount(errorKey);
    await this.cacheService.set(countKey, currentCount + 1, this.DEFAULT_TTL);
  }

  /**
   * Get TTL based on error type
   */
  private getTtlForErrorType(errorType: string): number {
    const criticalErrors = ['DatabaseError', 'ConnectionError', 'AuthenticationError'];
    if (criticalErrors.includes(errorType)) {
      return this.CRITICAL_TTL;
    }
    return this.DEFAULT_TTL;
  }

  /**
   * Get severity based on error type
   */
  private getSeverityForErrorType(errorType: string): 'low' | 'medium' | 'high' | 'critical' {
    if (errorType.includes('Database') || errorType.includes('Connection')) {
      return 'critical';
    }
    if (errorType.includes('Authentication') || errorType.includes('Authorization')) {
      return 'high';
    }
    if (errorType.includes('Validation') || errorType.includes('NotFound')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Clear error cache for a specific key
   */
  async clearError(errorKey: string): Promise<void> {
    const cacheKey = `${this.ERROR_CACHE_PREFIX}${errorKey}`;
    const countKey = `${this.ERROR_COUNT_PREFIX}${errorKey}`;
    await this.cacheService.del(cacheKey);
    await this.cacheService.del(countKey);
  }

  /**
   * Clear all error caches (use with caution)
   */
  async clearAllErrors(): Promise<void> {
    await this.cacheService.delPattern(`${this.ERROR_CACHE_PREFIX}*`);
    await this.cacheService.delPattern(`${this.ERROR_COUNT_PREFIX}*`);
    await this.cacheService.delPattern(`${this.ERROR_PATTERN_PREFIX}*`);
  }

  /**
   * Get all cached errors (for monitoring/debugging)
   */
  async getAllErrors(limit: number = 100): Promise<ErrorCacheEntry[]> {
    // In a real implementation, you'd query from database
    // For now, return empty array - can be enhanced
    return [];
  }

  /**
   * Get error statistics for monitoring
   */
  async getErrorStatistics(timeWindowMinutes: number = 60): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    topErrors: ErrorCacheEntry[];
    criticalErrors: ErrorCacheEntry[];
  }> {
    const errors: ErrorCacheEntry[] = [];
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const now = Date.now();
    const timeWindow = timeWindowMinutes * 60 * 1000;

    // This is a simplified implementation
    // In production, you'd query from database or aggregate from cache
    const allPatterns = await this.getAllErrorPatterns();
    
    for (const pattern of allPatterns) {
      errorsByType[pattern.pattern] = pattern.count;
      errorsBySeverity[pattern.severity] = (errorsBySeverity[pattern.severity] || 0) + pattern.count;
    }

    const totalErrors = Object.values(errorsByType).reduce((sum, count) => sum + count, 0);
    const criticalErrors = errors.filter((e) => 
      e.errorType.includes('Database') || 
      e.errorType.includes('Connection')
    );

    return {
      totalErrors,
      errorsByType,
      errorsBySeverity,
      topErrors: errors
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      criticalErrors,
    };
  }

  /**
   * Get all error patterns (enhanced version)
   */
  async getAllErrorPatterns(): Promise<ErrorPattern[]> {
    // In production, this would query from database
    // For now, return patterns from cache
    const patterns: ErrorPattern[] = [];
    
    // Try to get common error patterns from cache
    const commonErrorTypes = [
      'DatabaseError',
      'ConnectionError',
      'AuthenticationError',
      'ValidationError',
      'NotFoundError',
      'BadRequestError',
    ];

    for (const errorType of commonErrorTypes) {
      const patternKey = `${this.ERROR_PATTERN_PREFIX}${errorType}`;
      const pattern = await this.cacheService.get<ErrorPattern>(patternKey);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns.sort((a, b) => b.count - a.count);
  }

  /**
   * Check if error rate exceeds threshold (for rate limiting)
   */
  async isErrorRateExceeded(
    errorKey: string,
    maxErrorsPerMinute: number = 10,
    timeWindowMinutes: number = 1,
  ): Promise<boolean> {
    const entry = await this.getError(errorKey);
    if (!entry) {
      return false;
    }

    const timeWindow = timeWindowMinutes * 60 * 1000;
    const timeSinceFirstError = Date.now() - entry.firstOccurred.getTime();
    
    if (timeSinceFirstError < timeWindow) {
      const errorsPerMinute = (entry.count / timeWindowMinutes);
      return errorsPerMinute > maxErrorsPerMinute;
    }

    return false;
  }

  /**
   * Get errors by severity level
   */
  async getErrorsBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical',
  ): Promise<ErrorCacheEntry[]> {
    const allErrors = await this.getAllErrors();
    return allErrors.filter((error) => {
      const errorSeverity = this.getSeverityForErrorType(error.errorType);
      return errorSeverity === severity;
    });
  }

  /**
   * Batch cache multiple errors (for bulk operations)
   */
  async cacheErrors(
    errors: Array<{
      errorKey: string;
      error: Error | string;
      context?: Record<string, any>;
    }>,
  ): Promise<ErrorCacheEntry[]> {
    const results = await Promise.all(
      errors.map(({ errorKey, error, context }) =>
        this.cacheError(errorKey, error, context),
      ),
    );
    return results;
  }

  /**
   * Get error trends over time (for analytics)
   */
  async getErrorTrends(
    hours: number = 24,
  ): Promise<{
    hourly: Array<{ hour: string; count: number }>;
    byType: Record<string, number>;
  }> {
    // Simplified implementation
    // In production, this would query from database with time-based aggregation
    const patterns = await this.getAllErrorPatterns();
    const byType: Record<string, number> = {};

    for (const pattern of patterns) {
      byType[pattern.pattern] = pattern.count;
    }

    return {
      hourly: [], // Would be populated from database in production
      byType,
    };
  }

  /**
   * Suppress error for a period (useful for maintenance windows)
   */
  async suppressError(
    errorKey: string,
    durationMinutes: number = 60,
  ): Promise<void> {
    const entry = await this.getError(errorKey);
    if (entry) {
      entry.resolved = true;
      entry.resolvedAt = new Date();
      const cacheKey = `${this.ERROR_CACHE_PREFIX}${errorKey}`;
      await this.cacheService.set(cacheKey, entry, durationMinutes * 60);
      this.logger.log(
        `Error "${errorKey}" suppressed for ${durationMinutes} minutes`,
      );
    }
  }

  /**
   * Get operation health status
   */
  async getOperationHealth(operationKey: string): Promise<{
    healthy: boolean;
    errorCount: number;
    lastError?: Date;
    shouldRetry: boolean;
  }> {
    const entry = await this.getError(operationKey);
    const shouldRetry = await this.shouldRetry(operationKey);

    return {
      healthy: !entry || entry.resolved,
      errorCount: entry?.count || 0,
      lastError: entry?.lastOccurred,
      shouldRetry,
    };
  }

  /**
   * Check if operation should be skipped due to repeated errors
   */
  async shouldSkipOperation(
    operationKey: string,
    maxFailures: number = 5,
  ): Promise<boolean> {
    const count = await this.getErrorCount(operationKey);
    return count >= maxFailures;
  }

  /**
   * Wrap a function with error caching
   */
  async executeWithErrorCache<T>(
    operationKey: string,
    operation: () => Promise<T>,
    context?: Record<string, any>,
  ): Promise<T> {
    // Check if we should skip this operation
    if (await this.shouldSkipOperation(operationKey)) {
      const entry = await this.getError(operationKey);
      throw new Error(
        `Operation "${operationKey}" has failed ${entry?.count || 0} times. Skipping to prevent repeated failures.`,
      );
    }

    try {
      const result = await operation();
      
      // If successful, resolve any previous errors
      await this.resolveError(operationKey);
      
      return result;
    } catch (error) {
      // Cache the error
      await this.cacheError(operationKey, error as Error, context);
      throw error;
    }
  }
}

