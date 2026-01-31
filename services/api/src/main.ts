import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from './common/logger/logger.service';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression = require('compression');
import { randomUUID } from 'crypto';
import * as express from 'express';
import * as Sentry from '@sentry/node';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Initialize logger
const logger = new Logger();

// Bull board resources (kept at module scope so we can close them on shutdown)
let bullServerAdapter: any = null;
let bullJobsQueue: Queue | null = null;
let bullRedisClient: InstanceType<typeof IORedis> | null = null;

// Validate required environment variables
function validateEnvironment() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing: string[] = [];

  for (const key of required) {
    const value = process.env[key];
    if (!value || value.includes('your-') || value.includes('change-in-production')) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error(
      `Missing or invalid required environment variables: ${missing.join(', ')}`,
      'Environment Validation',
    );
    logger.error(
      'Please set these variables in Railway dashboard or .env file',
      'Environment Validation',
    );
    process.exit(1);
  }

  // Warn about weak JWT secrets
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn(
      'JWT_SECRET is too short (minimum 32 characters recommended)',
      'Environment Validation',
    );
  }

  logger.info('Environment variables validated successfully', 'Environment Validation');
}

async function bootstrap() {
  // Validate environment variables first
  validateEnvironment();

  logger.info('═══════════════════════════════════════════════════════════', 'Bootstrap');
  logger.info('🚀 BOOTSTRAP STARTED', 'Bootstrap');
  logger.info('═══════════════════════════════════════════════════════════', 'Bootstrap');
  logger.info(`Timestamp: ${new Date().toISOString()}`, 'Bootstrap');
  logger.info(`Node version: ${process.version}`, 'Bootstrap');
  logger.info(`Working directory: ${process.cwd()}`, 'Bootstrap');
  logger.info(`dist/main.js exists: ${require('fs').existsSync('./dist/main.js')}`, 'Bootstrap');
  logger.info('═══════════════════════════════════════════════════════════', 'Bootstrap');

  // CORS allowed origins - defined early so OPTIONS handler and enableCors both use it
  let allowedOrigins: string[] = [
    process.env.FRONTEND_URL,
    'https://hos-marketplaceweb-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean) as string[];
  if (!allowedOrigins.length) {
    allowedOrigins = ['https://hos-marketplaceweb-production.up.railway.app'];
  }

  try {
    logger.info('🚀 Starting API server...', 'Bootstrap');

    // Pre-flight check: Verify Prisma client can be imported and has RefreshToken
    logger.debug('🔍 PRE-FLIGHT CHECK: Verifying Prisma Client', 'Bootstrap');
    try {
      const { PrismaClient } = require('@prisma/client');
      const testClient = new PrismaClient();

      const hasRefreshToken = typeof testClient.refreshToken !== 'undefined';
      const hasUser = typeof testClient.user !== 'undefined';
      const hasProduct = typeof testClient.product !== 'undefined';

      logger.debug(`user model: ${hasUser ? 'YES ✅' : 'NO ❌'}`, 'Bootstrap');
      logger.debug(`product model: ${hasProduct ? 'YES ✅' : 'NO ❌'}`, 'Bootstrap');
      logger.debug(`refreshToken model: ${hasRefreshToken ? 'YES ✅' : 'NO ❌'}`, 'Bootstrap');

      if (!hasUser || !hasProduct) {
        logger.error(
          'CRITICAL: Basic Prisma models missing! Prisma client generation failed.',
          'Bootstrap',
        );
        const available = Object.keys(testClient)
          .filter((k) => !k.startsWith('$') && !k.startsWith('_'))
          .slice(0, 20)
          .join(', ');
        logger.error(`Available properties: ${available}`, 'Bootstrap');
        await testClient.$disconnect();
        throw new Error('Prisma client missing basic models - generation failed');
      }

      if (!hasRefreshToken) {
        logger.warn('RefreshToken model missing from PrismaClient!', 'Bootstrap');
        logger.warn('This may cause issues when auth methods are called.', 'Bootstrap');
        logger.warn('Solution: Regenerate Prisma client with: pnpm db:generate', 'Bootstrap');
        await testClient.$disconnect();
      } else {
        logger.debug('✅ Pre-flight check PASSED - All models found', 'Bootstrap');
        await testClient.$disconnect();
      }
    } catch (preflightError: any) {
      logger.error(`PRE-FLIGHT CHECK FAILED: ${preflightError?.message}`, 'Bootstrap');
      logger.debug(preflightError?.stack, 'Bootstrap');
      // Continue anyway - let module initialization show the real error
    }

    logger.debug('Creating NestFactory with AppModule...', 'Bootstrap');
    let app;
    try {
      // Initialize Sentry if configured
      if (process.env.SENTRY_DSN) {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV || 'production',
          tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
        });
        logger.info('✅ Sentry initialized', 'Bootstrap');
      }

      app = await NestFactory.create(AppModule, {
        cors: true, // Enable CORS at NestJS level first
        logger: logger,
      });
      logger.info('✅ AppModule initialized successfully', 'Bootstrap');

      // CORS first: handle OPTIONS preflight before any other middleware so browser gets CORS headers
      logger.info(`🌐 CORS allowed origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');

      // Check if origin is allowed - returns the origin if allowed, null if not
      const isOriginAllowed = (origin: string | undefined): string | null => {
        // No origin (e.g. server-to-server, mobile apps, curl) - allow
        if (!origin) return '*';
        // Check exact match or prefix match (for subdomains)
        const allowed = allowedOrigins.some((a) => a && (origin === a || origin.startsWith(a)));
        return allowed ? origin : null;
      };

      app.use((req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') {
          const origin = req.headers.origin as string | undefined;
          const allowedOrigin = isOriginAllowed(origin);

          if (allowedOrigin) {
            // Origin is allowed - set CORS headers and respond 204
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
            res.setHeader(
              'Access-Control-Allow-Methods',
              'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
            );
            res.setHeader(
              'Access-Control-Allow-Headers',
              'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key, Access-Control-Request-Method, Access-Control-Request-Headers',
            );
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Max-Age', '86400');
            return res.status(204).end();
          } else {
            // Origin is NOT allowed - reject with 403 (no CORS headers)
            logger.warn(`CORS blocked: ${origin}`, 'CORS');
            return res.status(403).json({ error: 'Origin not allowed', origin });
          }
        }
        next();
      });

      // Add security headers (helmet)
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
          crossOriginEmbedderPolicy: false, // Allow embedding for API docs
        }),
      );
      logger.info('✅ Security headers configured', 'Bootstrap');

      // Add response compression
      app.use(compression());
      logger.info('✅ Response compression enabled', 'Bootstrap');

      // Request ID middleware: propagate or generate X-Request-ID, set Sentry context
      app.use((req: any, res: any, next: any) => {
        const requestId = (req.headers['x-request-id'] as string)?.trim() || randomUUID();
        req.requestId = requestId;
        res.setHeader('X-Request-ID', requestId);
        if (typeof Sentry?.setTag === 'function') {
          Sentry.setTag('request_id', requestId);
          Sentry.configureScope((scope) => scope.setTag('request_id', requestId));
        }
        next();
      });
      logger.info('✅ Request ID middleware and Sentry context enabled', 'Bootstrap');

      // Note: PrismaService verification is done in DatabaseModule.onModuleInit()
      // We don't need to check it here as it may not be ready yet during app creation
    } catch (moduleError: any) {
      logger.error(`❌ AppModule initialization failed: ${moduleError?.message}`, 'Bootstrap');
      logger.error(moduleError?.stack, 'Bootstrap');
      throw moduleError; // Re-throw to be caught by outer try-catch
    }

    // Enhanced CORS configuration for non-OPTIONS requests
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          logger.debug('CORS: Allowing request with no origin', 'CORS');
          return callback(null, true);
        }

        // Check if origin is in allowed list - use exact match for security
        const isAllowed = allowedOrigins.some((allowed) => {
          if (!allowed) return false;
          // Exact match
          if (origin === allowed) return true;
          // For subdomains, check if origin is a subdomain of allowed
          // e.g., https://admin.hos-marketplace.com matches https://hos-marketplace.com
          try {
            const originUrl = new URL(origin);
            const allowedUrl = new URL(allowed);
            // Same protocol and base domain
            if (
              originUrl.protocol === allowedUrl.protocol &&
              originUrl.hostname.endsWith('.' + allowedUrl.hostname)
            ) {
              return true;
            }
          } catch {
            // Invalid URL, skip
          }
          return false;
        });

        if (isAllowed) {
          logger.debug(`CORS: Allowing origin: ${origin}`, 'CORS');
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`, 'CORS');
          logger.debug(`Allowed origins: ${allowedOrigins.join(', ')}`, 'CORS');
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
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-API-Key',
      ],
      exposedHeaders: ['Authorization', 'Content-Type'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400, // 24 hours
    });

    // Add CORS headers to all responses (safety net)
    app.use((req: any, res: any, next: any) => {
      const origin = req.headers.origin;
      const isAllowed =
        !origin ||
        allowedOrigins.some((allowed) => {
          if (!allowed) return false;
          return origin === allowed || origin.startsWith(allowed);
        });

      if (isAllowed || !origin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      next();
    });

    // Add root route handler via middleware BEFORE setting global prefix
    app.use('/', (req: any, res: any, next: any) => {
      if (req.path === '/' && req.method === 'GET') {
        return res.json({
          message: 'House of Spells Marketplace API',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          endpoints: {
            base: '/api',
            health: '/api/health',
            auth: '/api/auth',
            products: '/api/products',
            orders: '/api/orders',
            users: '/api/users',
            admin: '/api/admin',
            docs: '/api/docs',
          },
          documentation: 'API documentation available at /api/docs',
        });
      }
      next();
    });

    // API versioning: disabled – routes use /api prefix only (aligned with frontend).
    // Re-enable when you need a second API version (e.g. v2): uncomment below and add @Version('1') to controllers.
    // app.enableVersioning({
    //   type: VersioningType.URI,
    //   defaultVersion: '1',
    //   prefix: 'v',
    // });
    logger.info('✅ API routes use /api prefix (versioning disabled)', 'Bootstrap');

    // Global prefix for all routes
    app.setGlobalPrefix('api');

    // Configure Swagger/OpenAPI documentation
    const config = new DocumentBuilder()
      .setTitle('House of Spells Marketplace API')
      .setDescription('Complete API documentation for the House of Spells Marketplace platform')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('products', 'Product management')
      .addTag('orders', 'Order processing')
      .addTag('cart', 'Shopping cart operations')
      .addTag('users', 'User management')
      .addTag('admin', 'Admin operations')
      .addTag('sellers', 'Seller operations')
      .addTag('health', 'Health check endpoints')
      .addServer('https://hos-marketplaceapi-production.up.railway.app/api', 'Production')
      .addServer('http://localhost:3001/api', 'Local Development')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
    logger.info('✅ Swagger documentation available at /api/docs', 'Bootstrap');

    // Bull Board dashboard for monitoring queues (optional - requires @bull-board packages)
    try {
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath('/api/admin/queues');
      // Connect to existing Redis via REDIS_URL
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      // Create a shared IORedis instance so we can close it on shutdown
      bullRedisClient = new IORedis(redisUrl);
      const jobsQueue = new Queue('jobs', { connection: bullRedisClient });
      const bullAdapter = new BullMQAdapter(jobsQueue);
      createBullBoard({
        queues: [bullAdapter as any],
        serverAdapter,
      });
      // Mount router
      app.use('/api/admin/queues', serverAdapter.getRouter());
      // Save references for graceful shutdown
      bullServerAdapter = serverAdapter;
      bullJobsQueue = jobsQueue;
      logger.info('✅ Bull Board mounted at /api/admin/queues');
    } catch (err: any) {
      logger.warn('Bull Board not available (missing packages or redis) - skipping dashboard');
    }

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global Sentry exception filter (capture all HTTP exceptions to Sentry)
    app.useGlobalFilters(new SentryExceptionFilter());
    logger.info('✅ Sentry exception filter registered', 'Bootstrap');

    // Add request size limits (NestJS handles JSON parsing, but we can set limits via the underlying Express instance)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(express.json({ limit: '10mb' }));
    expressApp.use(express.urlencoded({ limit: '10mb', extended: true }));
    logger.info('✅ Request size limits configured (10MB)', 'Bootstrap');

    const port = process.env.PORT || 3001;
    logger.info(`📡 About to listen on port: ${port}`, 'Bootstrap');

    // Use app.listen() to ensure all routes are properly registered
    await app.listen(port, '0.0.0.0');

    logger.info(`✅ Server is listening on port ${port}`, 'Bootstrap');
    logger.info(`✅ API server is running on: http://0.0.0.0:${port}/api`, 'Bootstrap');
    logger.info(`✅ Health check available at: http://0.0.0.0:${port}/api/health`, 'Bootstrap');
    logger.info(`✅ Root endpoint available at: http://0.0.0.0:${port}/`, 'Bootstrap');
    logger.info('✅ Liveness at /api/health/live, readiness at /api/health/ready', 'Bootstrap');

    // Graceful shutdown: close Nest app (HTTP, Prisma, etc.) then Bull Board resources
    const shutdownBullBoard = async () => {
      try {
        if (bullJobsQueue) {
          await bullJobsQueue.close();
          logger.log('Bull queue closed');
        }
        if (bullRedisClient) {
          await bullRedisClient.quit();
          logger.log('Bull Redis client disconnected');
        }
        if (bullServerAdapter && typeof bullServerAdapter.close === 'function') {
          try {
            bullServerAdapter.close();
          } catch {}
          logger.log('Bull Board server adapter closed');
        }
      } catch (err) {
        logger.error('Error during Bull Board shutdown', err);
      }
    };

    const gracefulShutdown = async (signal: string) => {
      logger.log(`${signal} received: shutting down gracefully`);
      try {
        if (app) {
          await app.close();
          logger.log('Nest application closed');
        }
      } catch (err) {
        logger.error('Error closing Nest application', err);
      }
      await shutdownBullBoard();
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error: any) {
    logger.error('═══════════════════════════════════════════════════════════', 'Bootstrap');
    logger.error('❌ CRITICAL ERROR: Failed to start API server', 'Bootstrap');
    logger.error('═══════════════════════════════════════════════════════════', 'Bootstrap');
    logger.error(`Error name: ${error?.name || 'Unknown'}`, 'Bootstrap');
    logger.error(`Error message: ${error?.message || 'Unknown error'}`, 'Bootstrap');
    logger.error(`Error stack: ${error?.stack || 'No stack trace available'}`, 'Bootstrap');
    logger.error(`NODE_ENV: ${process.env.NODE_ENV}`, 'Bootstrap');
    logger.error(`PORT: ${process.env.PORT}`, 'Bootstrap');
    logger.error(
      `DATABASE_URL: ${process.env.DATABASE_URL ? '***set***' : '***missing***'}`,
      'Bootstrap',
    );
    logger.error(`Working directory: ${process.cwd()}`, 'Bootstrap');
    logger.error('═══════════════════════════════════════════════════════════', 'Bootstrap');
    // Give Railway time to capture logs before exiting
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }
}

// Add unhandled error handlers to catch any errors outside bootstrap
process.on('uncaughtException', (error) => {
  logger.error('═══════════════════════════════════════════════════════════', 'Process');
  logger.error('❌ UNCAUGHT EXCEPTION', 'Process');
  logger.error('═══════════════════════════════════════════════════════════', 'Process');
  logger.error(`Error: ${error.message}`, 'Process');
  logger.error(`Stack: ${error.stack}`, 'Process');
  logger.error('═══════════════════════════════════════════════════════════', 'Process');
  setTimeout(() => process.exit(1), 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('═══════════════════════════════════════════════════════════', 'Process');
  logger.error('❌ UNHANDLED REJECTION', 'Process');
  logger.error('═══════════════════════════════════════════════════════════', 'Process');
  logger.error(`Reason: ${reason}`, 'Process');
  logger.error(`Promise: ${promise}`, 'Process');
  logger.error('═══════════════════════════════════════════════════════════', 'Process');
  // In production, consider exiting on unhandled rejections
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 5000);
  }
});

// Start bootstrap
logger.info('═══════════════════════════════════════════════════════════', 'Bootstrap');
logger.info('📝 About to call bootstrap()', 'Bootstrap');
logger.info(`Timestamp: ${new Date().toISOString()}`, 'Bootstrap');
logger.info('═══════════════════════════════════════════════════════════', 'Bootstrap');

bootstrap().catch((error) => {
  logger.error('═══════════════════════════════════════════════════════════', 'Bootstrap');
  logger.error('❌ BOOTSTRAP PROMISE REJECTED', 'Bootstrap');
  logger.error('═══════════════════════════════════════════════════════════', 'Bootstrap');
  logger.error(`Error: ${error?.message}`, 'Bootstrap');
  logger.error(`Stack: ${error?.stack}`, 'Bootstrap');
  logger.error('═══════════════════════════════════════════════════════════', 'Bootstrap');
  setTimeout(() => process.exit(1), 5000);
});
