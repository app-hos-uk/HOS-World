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
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: { message: string } =
      exception instanceof HttpException
        ? (typeof (exception.getResponse() as any) === 'object'
            ? (exception.getResponse() as any)
            : { message: (exception.getResponse() as any)?.message || (exception.getResponse() as any) })
        : { message: (exception as any)?.message || 'Internal server error' };

    // If Prisma/DB reports missing column (e.g. migration not run), return 503 with clearer message
    const msg = (message?.message || '').toString();
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      ((msg.includes('column') && msg.includes('does not exist')) || msg.includes('Unknown column'))
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = {
        message:
          'Service temporarily unavailable. A database update may be required. Please try again later or contact support.',
      };
    }

    response.status(status).json({
      ...message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

