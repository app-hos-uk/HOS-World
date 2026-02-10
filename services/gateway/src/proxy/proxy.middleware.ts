import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { JwtValidationService } from './jwt-validation.service';
import { getServiceConfigs, ServiceConfig } from '../config/services.config';

/**
 * Proxy Middleware
 *
 * Core gateway logic:
 * 1. Match the incoming request URL to a service via route prefixes
 * 2. Validate JWT (if present) and inject user context headers
 * 3. Proxy the request to the target service
 *
 * The middleware creates one http-proxy-middleware instance per service
 * and caches them. Requests are matched from most specific to least
 * specific prefix.
 */
@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProxyMiddleware.name);
  private readonly proxyCache = new Map<string, ReturnType<typeof createProxyMiddleware>>();
  private readonly services: ServiceConfig[];

  constructor(private readonly jwtValidation: JwtValidationService) {
    this.services = getServiceConfigs();
  }

  use(req: Request, res: Response, next: NextFunction) {
    // 1. Find the target service for this request
    const service = this.findService(req.path);
    if (!service) {
      // No matching service -- pass through to NestJS controllers (health, etc.)
      return next();
    }

    // 2. Validate JWT and inject user context headers for downstream services
    this.injectAuthHeaders(req);

    // 3. Add correlation ID
    if (!req.headers['x-correlation-id'] && !req.headers['x-request-id']) {
      req.headers['x-correlation-id'] = this.generateId();
    }

    // 4. Get or create proxy for this service
    const proxy = this.getOrCreateProxy(service);
    return proxy(req, res, next);
  }

  /**
   * Find the most specific service matching the request path.
   * Sorted by prefix length descending so more specific routes win.
   */
  private findService(path: string): ServiceConfig | null {
    // Check enabled non-monolith services first (sorted by prefix length desc)
    const specificServices = this.services
      .filter((s) => s.enabled && s.name !== 'monolith-api')
      .sort(
        (a, b) =>
          Math.max(...b.prefixes.map((p) => p.length)) -
          Math.max(...a.prefixes.map((p) => p.length)),
      );

    for (const svc of specificServices) {
      for (const prefix of svc.prefixes) {
        if (path === prefix || path.startsWith(prefix + '/')) {
          return svc;
        }
      }
    }

    // Fall back to monolith
    const monolith = this.services.find((s) => s.name === 'monolith-api');
    if (monolith?.enabled && path.startsWith('/api')) {
      return monolith;
    }

    return null;
  }

  /**
   * Validate JWT and inject X-User-* headers for downstream services
   */
  private injectAuthHeaders(req: Request) {
    const token = this.jwtValidation.extractToken(
      req.headers.authorization,
    );

    if (token) {
      const user = this.jwtValidation.validateToken(token);
      if (user) {
        req.headers['x-user-id'] = user.id;
        req.headers['x-user-email'] = user.email;
        req.headers['x-user-role'] = user.role;
        if (user.tenantId) req.headers['x-tenant-id'] = user.tenantId;
        if (user.permissionRoleId)
          req.headers['x-user-permission-role-id'] = user.permissionRoleId;
        if (user.sellerId) req.headers['x-user-seller-id'] = user.sellerId;
        if (user.firstName)
          req.headers['x-user-first-name'] = user.firstName;
        if (user.lastName)
          req.headers['x-user-last-name'] = user.lastName;
      }
    }

    // Always forward the original Authorization header so the monolith
    // (which still has its own JWT guard) can validate during migration.
  }

  /**
   * Get or create a cached proxy instance for a service
   */
  private getOrCreateProxy(
    service: ServiceConfig,
  ): ReturnType<typeof createProxyMiddleware> {
    if (this.proxyCache.has(service.name)) {
      return this.proxyCache.get(service.name)!;
    }

    const proxyOptions: Options = {
      target: service.url,
      changeOrigin: true,
      // Keep the original path (don't rewrite)
      pathRewrite: undefined,
      // Timeout per request (30s)
      proxyTimeout: 30000,
      on: {
        proxyReq: (proxyReq, req: any) => {
          this.logger.debug(
            `[${service.name}] ${req.method} ${req.url} -> ${service.url}${req.url}`,
          );
        },
        error: (err, req: any, res: any) => {
          this.logger.error(
            `[${service.name}] Proxy error for ${req?.method} ${req?.url}: ${err.message}`,
          );
          if (res && !res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: 502,
                message: `Service ${service.name} is unavailable`,
                timestamp: new Date().toISOString(),
              }),
            );
          }
        },
      },
    };

    const proxy = createProxyMiddleware(proxyOptions);
    this.proxyCache.set(service.name, proxy);
    return proxy;
  }

  private generateId(): string {
    return `gw-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
