import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    try {
      Sentry.captureException(exception);
    } catch (e) {
      // ignore Sentry errors
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

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

