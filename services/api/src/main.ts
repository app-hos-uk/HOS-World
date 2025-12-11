import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Conditionally import compression - handle gracefully if not available
let compression: any;
try {
  compression = require('compression');
} catch (error) {
  console.warn('⚠️ Compression module not available - responses will not be compressed');
}

async function bootstrap() {
  try {
    console.log('🚀 Starting API server...');
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? '***set***' : '***missing***',
    });

    // Validate critical environment variables
    if (!process.env.DATABASE_URL) {
      console.error('❌ CRITICAL: DATABASE_URL environment variable is not set!');
      console.error('❌ Application cannot start without database connection.');
      console.error('❌ Please set DATABASE_URL in Railway environment variables.');
      process.exit(1);
    }

    const app = await NestFactory.create(AppModule, {
      cors: true, // Enable CORS at NestJS level first
    });

    // Define allowed origins - MUST be before any middleware
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://hos-marketplaceweb-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean); // Remove undefined values

    console.log('🌐 CORS allowed origins:', allowedOrigins);

    // CRITICAL: Handle OPTIONS requests FIRST - before any other middleware
    // This ensures preflight requests are handled even if the app has errors
    app.use((req: any, res: any, next: any) => {
      // Handle preflight OPTIONS requests immediately
      if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        
        // Check if origin is allowed
        const isAllowed = !origin || allowedOrigins.some(allowed => {
          if (!allowed) return false;
          return origin === allowed || origin.startsWith(allowed);
        });
        
        if (isAllowed || !origin) {
          console.log(`✅ CORS Preflight: Allowing ${origin || 'no-origin'} for ${req.path}`);
          res.header('Access-Control-Allow-Origin', origin || '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key, Access-Control-Request-Method, Access-Control-Request-Headers');
          res.header('Access-Control-Allow-Credentials', 'true');
          res.header('Access-Control-Max-Age', '86400');
          return res.status(204).send();
        } else {
          console.warn(`⚠️  CORS Preflight blocked: ${origin}`);
          return res.status(403).json({ error: 'CORS not allowed' });
        }
      }
      next();
    });

    // Enhanced CORS configuration for all other requests
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          console.log('✅ CORS: Allowing request with no origin');
          return callback(null, true);
        }
        
        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.some(allowed => {
          if (!allowed) return false;
          if (origin === allowed) return true;
          // Also allow if origin starts with allowed (for subdomains)
          if (origin.startsWith(allowed)) return true;
          return false;
        });
        
        if (isAllowed) {
          console.log(`✅ CORS: Allowing origin: ${origin}`);
          callback(null, true);
        } else {
          console.warn(`⚠️  CORS blocked origin: ${origin}`);
          console.warn(`⚠️  Allowed origins: ${allowedOrigins.join(', ')}`);
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
      const isAllowed = !origin || allowedOrigins.some(allowed => {
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
          endpoints: {
            api: '/api',
            health: '/api/health',
            products: '/api/products',
            auth: '/api/auth',
          },
          documentation: 'API documentation coming soon',
        });
      }
      next();
    });

    // Enable response compression (if available)
    if (compression) {
      app.use(compression({
        filter: (req, res) => {
          // Compress all responses except health checks
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
        level: 6, // Compression level (1-9, 6 is a good balance)
        threshold: 1024, // Only compress responses larger than 1KB
      }));
      console.log('✅ Response compression enabled');
    }

    // Global prefix for all routes
    app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const port = process.env.PORT || 3001;
    console.log(`📡 About to listen on port: ${port}`);
    
    // Use app.listen() to ensure all routes are properly registered
    await app.listen(port, '0.0.0.0');
    
    console.log(`✅ Server is listening on port ${port}`);
    console.log(`✅ API server is running on: http://0.0.0.0:${port}/api`);
    console.log(`✅ Health check available at: http://0.0.0.0:${port}/api/health`);
    console.log(`✅ Root endpoint available at: http://0.0.0.0:${port}/`);
  } catch (error) {
    console.error('❌ Failed to start API server:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

bootstrap();


