import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  // Skip rate limiting for health check endpoints
  protected shouldSkip(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.url || request.path;

    // Skip rate limiting for health endpoints
    if (path && (path.startsWith('/api/health') || path.startsWith('/health'))) {
      return true;
    }

    return false;
  }
}


