import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    private activityService: ActivityService,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query, user } = request;

    // Only log for POST, PUT, DELETE, PATCH methods
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    // Extract entity type from URL
    const entityType = this.extractEntityType(url);
    const action = this.getAction(method, entityType);

    // Get IP address and user agent
    const ipAddress =
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.ip ||
      request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // Get seller ID if user is a seller
          let sellerId: string | undefined;
          if (user) {
            const seller = await this.prisma.seller.findUnique({
              where: { userId: user.id },
              select: { id: true },
            });
            if (seller) {
              sellerId = seller.id;
            }
          }

          // Extract entity ID from response or params
          const entityId = response?.data?.id || params?.id || body?.id;

          // Build description
          const description = this.buildDescription(method, entityType, entityId, body);

          // Create activity log (fire and forget)
          this.activityService
            .createLog({
              userId: user?.id,
              sellerId,
              action,
              entityType,
              entityId,
              description,
              metadata: {
                method,
                url,
                body: this.sanitizeBody(body),
                params,
                query,
                response: this.sanitizeResponse(response),
              },
              ipAddress,
              userAgent,
            })
            .catch((error) => {
              // Silently fail - don't break the request
              console.error('Failed to log activity:', error);
            });
        } catch (error) {
          // Silently fail - don't break the request
          console.error('Error in activity interceptor:', error);
        }
      }),
    );
  }

  private extractEntityType(url: string): string {
    // Extract entity type from URL patterns like /products, /orders, /sellers
    const match = url.match(/\/([^\/]+)/);
    if (match) {
      const segment = match[1];
      // Remove query params and pluralize/singularize
      const clean = segment.split('?')[0];
      return clean.charAt(0).toUpperCase() + clean.slice(1).replace(/s$/, '');
    }
    return 'Unknown';
  }

  private getAction(method: string, entityType: string): string {
    const actions: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    const action = actions[method] || method;
    return `${entityType}_${action}`;
  }

  private buildDescription(
    method: string,
    entityType: string,
    entityId: string | undefined,
    body: any,
  ): string {
    const action = method === 'POST' ? 'created' : method === 'DELETE' ? 'deleted' : 'updated';
    const idPart = entityId ? ` (ID: ${entityId})` : '';
    const namePart = body?.name || body?.storeName || body?.title || '';
    const nameStr = namePart ? ` "${namePart}"` : '';
    return `${entityType}${nameStr}${idPart} was ${action}`;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.refreshToken;
    return sanitized;
  }

  private sanitizeResponse(response: any): any {
    if (!response) return null;
    if (response.data) {
      const sanitized = { ...response.data };
      // Remove sensitive fields
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.refreshToken;
      return sanitized;
    }
    return response;
  }
}

