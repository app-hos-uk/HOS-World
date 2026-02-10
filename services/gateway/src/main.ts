import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression = require('compression');
import { AppModule } from './app.module';

const logger = new Logger('Gateway');

async function bootstrap() {
  logger.log('Starting API Gateway...');

  const app = await NestFactory.create(AppModule, {
    cors: false, // We handle CORS explicitly below
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // ─── CORS Configuration ──────────────────────────────────────────────────
  const allowedOrigins: string[] = [
    process.env.FRONTEND_URL,
    'https://hos-marketplaceweb-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean) as string[];

  // Handle OPTIONS preflight
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin as string | undefined;

      // Preflight MUST include an Origin header and it must match our allow-list.
      // A missing Origin on a preflight is not a legitimate browser request.
      if (!origin || !allowedOrigins.some((a) => origin === a)) {
        logger.warn(`CORS preflight blocked: ${origin || '(no origin)'}`);
        return res.status(403).json({ error: 'Origin not allowed', origin: origin || null });
      }

      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key, X-Correlation-ID',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
    next();
  });

  // CORS for non-OPTIONS requests
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header = same-origin or non-browser client.
      // Allow the request but don't set any Access-Control-Allow-Origin header.
      if (!origin) return callback(null, false);
      const isAllowed = allowedOrigins.some((allowed) => {
        if (!allowed) return false;
        if (origin === allowed) return true;
        try {
          const originUrl = new URL(origin);
          const allowedUrl = new URL(allowed);
          if (
            originUrl.protocol === allowedUrl.protocol &&
            originUrl.hostname.endsWith('.' + allowedUrl.hostname)
          ) {
            return true;
          }
        } catch {
          // skip
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-API-Key',
      'X-Correlation-ID',
    ],
    exposedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-ID'],
    maxAge: 86400,
  });

  // ─── Security ────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ─── Compression ─────────────────────────────────────────────────────────
  app.use(compression());

  // Global prefix for consistency with other microservices (health at /api/health/live)
  app.setGlobalPrefix('api');

  // ─── Root Endpoint ───────────────────────────────────────────────────────
  app.use('/', (req: any, res: any, next: any) => {
    if (req.path === '/' && req.method === 'GET') {
      return res.json({
        service: 'HOS Marketplace API Gateway',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          healthLive: '/api/health/live',
          services: '/api/health/services',
          circuits: '/api/health/circuits',
          api: '/api',
        },
      });
    }
    next();
  });

  const port = process.env.GATEWAY_PORT || process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(`API Gateway running on http://0.0.0.0:${port}`);
  logger.log(`Health check: http://0.0.0.0:${port}/api/health/live`);
  logger.log(`Service registry: http://0.0.0.0:${port}/api/health/services`);
}

bootstrap().catch((error) => {
  logger.error(`Gateway failed to start: ${error?.message}`);
  logger.error(error?.stack);
  process.exit(1);
});
