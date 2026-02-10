import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Sentry Exception Filter
 *
 * Catches all unhandled exceptions and reports them to Sentry.
 * Sends a standardized JSON error response to the client.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message || exception.message;
    }

    // Report to Sentry (skip 4xx client errors)
    if (status >= 500) {
      try {
        Sentry.captureException(exception, {
          contexts: {
            request: {
              method: request?.method,
              url: request?.url,
              headers: request?.headers,
            },
          },
        });
      } catch {
        // Sentry not initialized
      }
      this.logger.error(
        `${request?.method} ${request?.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url,
    });
  }
}
