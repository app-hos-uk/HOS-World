import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const requestId = request?.requestId || request?.headers?.['x-request-id'];
    try {
      if (requestId && typeof Sentry?.setTag === 'function') {
        Sentry.setTag('request_id', requestId);
      }
      Sentry.captureException(exception);
    } catch (e) {
      // ignore Sentry errors
    }

    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)
        : { message: (exception as any)?.message || 'Internal server error' };

    response.status(status).json({
      ...message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

